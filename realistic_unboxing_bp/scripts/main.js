import { world, system, ItemStack, Player, BlockPermutation } from "@minecraft/server";

// Track player unboxing queue and active session
// unboxingQueue: Map<player.id, Array<{ remainingTicks: number, itemTypeId: string, count: number, totalTicks: number }>>
const unboxingQueues = new Map();

// Queue of boxed items per player waiting to be unboxed when cardboard box is broken
// pendingBoxedItems: Map<player.id, Array<{ typeId: string, count: number }>>
const pendingBoxedItems = new Map();

// Set of unboxed item exemptions so awarded items aren't immediately re-boxed
// unboxedExemptions: Map<player.id, Map<string, number>>
const unboxedExemptions = new Map();

// Track previous total inventory item counts per player
// playerInventoryTotals: Map<player.id, Map<string, number>>
const playerInventoryTotals = new Map();

// Helper to get inventory container safely across Script API versions
function getPlayerInventory(player) {
    const comp = player.getComponent("minecraft:inventory") || player.getComponent("inventory");
    return comp?.container;
}

// Helper to fill empty slots in player inventory with bubble wrap
function fillInventoryWithBubbleWrap(player, bubbleCount = 6) {
    const inventory = getPlayerInventory(player);
    if (!inventory) return;

    let added = 0;
    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (!item && added < bubbleCount) {
            try {
                inventory.setItem(slot, new ItemStack("unboxing:bubble_wrap", 1));
                added++;
            } catch (e) {
                // Ignore if item creation fails or slot unavailable
            }
        }
    }
    player.sendMessage("§e[Unboxing] §cYour inventory was clogged with bubble wrap packaging!");
    player.playSound("random.pop", { pitch: 1.5, volume: 1.0 });
}

// Function to place a cardboard shipping box block in front of or near the player
function generateShippingBoxBlock(player, itemTypeId, count = 1) {
    // Add item to pending boxed items queue for this player
    let playerQueue = pendingBoxedItems.get(player.id);
    if (!playerQueue) {
        playerQueue = [];
        pendingBoxedItems.set(player.id, playerQueue);
    }
    playerQueue.push({ typeId: itemTypeId, count: count });

    const dimension = player.dimension;
    const location = player.location;

    // Find a valid air block near player location
    const offsets = [
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: -1, z: 0 }
    ];

    let targetBlock = null;
    const px = Math.floor(location.x);
    const py = Math.floor(location.y);
    const pz = Math.floor(location.z);

    for (const off of offsets) {
        const b = dimension.getBlock({ x: px + off.x, y: py + off.y, z: pz + off.z });
        if (b && (b.isAir || b.isLiquid)) {
            targetBlock = b;
            break;
        }
    }

    if (!targetBlock) {
        targetBlock = dimension.getBlock({ x: px, y: py, z: pz });
    }

    if (targetBlock) {
        targetBlock.setPermutation(BlockPermutation.resolve("unboxing:shipping_box"));
        const cleanName = itemTypeId.replace("minecraft:", "").replace(/_/g, " ");
        player.sendMessage(`§e[Unboxing] §fCrafted §6${cleanName}§f packaged into a §6Cardboard Shipping Box§f block at [${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z}]!`);
        player.playSound("armor.equip_generic", { pitch: 0.8, volume: 1.0 });
    } else {
        // Fallback if block placement fails
        const inventory = getPlayerInventory(player);
        if (inventory) {
            inventory.addItem(new ItemStack("unboxing:shipping_box", 1));
            player.sendMessage("§e[Unboxing] §fCrafted item packaged into a §6Cardboard Shipping Box§f!");
        }
    }
}

// Handle Cardboard Shipping Box Placement & Breaking
world.afterEvents.playerBreakBlock.subscribe((event) => {
    const { player, brokenBlockPermutation } = event;
    if (!player) return;

    const blockTypeId = brokenBlockPermutation.type.id;
    if (blockTypeId === "unboxing:shipping_box" || brokenBlockPermutation.matches("unboxing:shipping_box")) {
        // Break the box: Clog inventory with bubble wrap and start unboxing animation!
        fillInventoryWithBubbleWrap(player, 6);

        // Retrieve boxed item from queue or fallback
        let boxedItem = { typeId: "minecraft:stone_pickaxe", count: 1 };
        const playerQueue = pendingBoxedItems.get(player.id);
        if (playerQueue && playerQueue.length > 0) {
            boxedItem = playerQueue.shift();
        }

        // Queue 5 second unboxing timer (100 ticks = 5 seconds)
        queueUnboxingAnimation(player, boxedItem.typeId, boxedItem.count);
    }
});

// Function to queue 5-second unboxing animation
function queueUnboxingAnimation(player, itemTypeId, count = 1) {
    const totalSeconds = 5;
    const totalTicks = totalSeconds * 20; // 100 ticks

    let queue = unboxingQueues.get(player.id);
    if (!queue) {
        queue = [];
        unboxingQueues.set(player.id, queue);
    }

    queue.push({
        remainingTicks: totalTicks,
        totalTicks: totalTicks,
        itemTypeId: itemTypeId,
        count: count
    });

    const cleanName = itemTypeId.replace("minecraft:", "").replace(/_/g, " ");
    player.sendMessage(`§e[Unboxing] §bUnboxing ${cleanName}... Please wait 5 seconds!`);
}

// Helper to remove 1 unit of an item type from player's inventory
function removeItemFromInventory(inventory, itemTypeId) {
    for (let slot = 0; slot < inventory.size; slot++) {
        const item = inventory.getItem(slot);
        if (item && item.typeId === itemTypeId) {
            if (item.amount > 1) {
                inventory.setItem(slot, new ItemStack(item.typeId, item.amount - 1));
            } else {
                inventory.setItem(slot, undefined);
            }
            return true;
        }
    }
    return false;
}

// Continuous Inventory Monitor loop to catch newly crafted items (by tracking total item counts)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const inventory = getPlayerInventory(player);
        if (!inventory) continue;

        let prevTotals = playerInventoryTotals.get(player.id);
        const isFirstScan = !prevTotals;
        if (!prevTotals) {
            prevTotals = new Map();
            playerInventoryTotals.set(player.id, prevTotals);
        }

        let playerExemptions = unboxedExemptions.get(player.id);
        if (!playerExemptions) {
            playerExemptions = new Map();
            unboxedExemptions.set(player.id, playerExemptions);
        }

        const currentTotals = new Map();

        // Calculate total amounts per item type across entire inventory
        for (let slot = 0; slot < inventory.size; slot++) {
            const item = inventory.getItem(slot);
            if (item) {
                const count = currentTotals.get(item.typeId) || 0;
                currentTotals.set(item.typeId, count + item.amount);
            }
        }

        if (!isFirstScan) {
            for (const [typeId, currentAmount] of currentTotals.entries()) {
                // Ignore addon items themselves
                if (typeId === "unboxing:shipping_box" || typeId === "unboxing:bubble_wrap") {
                    continue;
                }

                const prevAmount = prevTotals.get(typeId) || 0;

                // Check if total count increased
                if (currentAmount > prevAmount) {
                    const diff = currentAmount - prevAmount;

                    // Check if this increase was due to an unboxing award exemption
                    const exemptCount = playerExemptions.get(typeId) || 0;
                    if (exemptCount >= diff) {
                        playerExemptions.set(typeId, exemptCount - diff);
                    } else {
                        // Net increase not exempt -> Intercept newly crafted item!
                        const netNew = diff - exemptCount;
                        if (exemptCount > 0) {
                            playerExemptions.set(typeId, 0);
                        }

                        for (let i = 0; i < netNew; i++) {
                            const removed = removeItemFromInventory(inventory, typeId);
                            if (removed) {
                                generateShippingBoxBlock(player, typeId, 1);
                            }
                        }

                        // Re-calculate current totals after removal
                        currentTotals.set(typeId, (currentTotals.get(typeId) || 0) - netNew);
                    }
                }
            }
        }

        playerInventoryTotals.set(player.id, currentTotals);
    }
}, 4); // Scan every 4 ticks (0.2s)

// Main tick loop for unboxing animations (processing queues sequentially per player)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const queue = unboxingQueues.get(player.id);
        if (!queue || queue.length === 0) continue;

        const session = queue[0]; // Process active session at head of queue
        session.remainingTicks -= 2; // runs every 2 ticks (10Hz update)

        const secondsLeft = (session.remainingTicks / 20).toFixed(1);
        const progressPercent = Math.max(0, Math.min(100, Math.floor(((session.totalTicks - session.remainingTicks) / session.totalTicks) * 100)));

        const cleanName = session.itemTypeId.replace("minecraft:", "").replace(/_/g, " ");

        // Animation visuals: Sound + Title / Actionbar animation
        const progressBarLength = 10;
        const filled = Math.floor((progressPercent / 100) * progressBarLength);
        const empty = progressBarLength - filled;
        const bar = "§a" + "■".repeat(filled) + "§7" + "░".repeat(empty);

        const queueText = queue.length > 1 ? ` §7(+${queue.length - 1} queued)` : "";
        player.onScreenDisplay.setActionBar(`§6📦 Unboxing ${cleanName}... ${bar} §e${secondsLeft}s §f(${progressPercent}%)${queueText}`);

        // Sound effects during unboxing
        if (session.remainingTicks % 10 === 0) {
            player.playSound("block.itemframe.remove_item", { pitch: 1.2, volume: 0.8 });
            player.playSound("ui.stonecutter.take_result", { pitch: 1.5, volume: 0.5 });
        }

        // Complete unboxing for current item!
        if (session.remainingTicks <= 0) {
            queue.shift(); // Remove completed session from queue

            // Add exemption count for this unboxed item type so total scanner doesn't re-box it!
            let playerExemptions = unboxedExemptions.get(player.id);
            if (!playerExemptions) {
                playerExemptions = new Map();
                unboxedExemptions.set(player.id, playerExemptions);
            }
            const curExempt = playerExemptions.get(session.itemTypeId) || 0;
            playerExemptions.set(session.itemTypeId, curExempt + session.count);

            // Award final unboxed item
            const inventory = getPlayerInventory(player);
            if (inventory) {
                try {
                    inventory.addItem(new ItemStack(session.itemTypeId, session.count));
                } catch (e) {
                    player.dimension.spawnItem(new ItemStack(session.itemTypeId, session.count), player.location);
                }
            }

            // Completion effects
            player.onScreenDisplay.setTitle("§aUNBOXED!");
            player.onScreenDisplay.setSubtitle(`§fEquipped §6${cleanName}§f!`);
            player.sendMessage(`§a[Unboxing] §fSuccessfully unboxed your §6${cleanName}§f!`);
            player.playSound("random.levelup", { pitch: 1.2, volume: 1.0 });
            player.playSound("ui.toast.challenge_complete", { pitch: 1.0, volume: 1.0 });
        }
    }
}, 2);

// Item use interaction for shipping box item (if right clicked)
world.afterEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;
    if (itemStack.typeId === "unboxing:shipping_box") {
        player.sendMessage("§e[Unboxing] §fPlace the §6Cardboard Shipping Box§f on the ground and break it to open!");
    }
});
