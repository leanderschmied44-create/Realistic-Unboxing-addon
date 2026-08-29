from PIL import Image, ImageDraw
import os

rp_textures_blocks = "realistic_unboxing_rp/textures/blocks"
rp_textures_items = "realistic_unboxing_rp/textures/items"
os.makedirs(rp_textures_blocks, exist_ok=True)
os.makedirs(rp_textures_items, exist_ok=True)

def create_cardboard_base(width=16, height=16):
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    # Base cardboard shades
    c_main = (181, 137, 91, 255) # #b5895b
    c_dark = (160, 118, 73, 255)
    c_light = (198, 153, 105, 255)
    c_deep = (138, 99, 58, 255)

    pixels = img.load()
    import random
    random.seed(42)
    for y in range(height):
        for x in range(width):
            r = random.random()
            if r < 0.6:
                pixels[x, y] = c_main
            elif r < 0.8:
                pixels[x, y] = c_light
            elif r < 0.95:
                pixels[x, y] = c_dark
            else:
                pixels[x, y] = c_deep
    return img

# 1. Shipping Box Top
top_img = create_cardboard_base(16, 16)
draw = ImageDraw.Draw(top_img)

# Flap seam down center
draw.line([(8, 0), (8, 15)], fill=(110, 75, 40, 255), width=1)

# Packing tape over seam (columns 7 and 8)
tape_color = (225, 205, 160, 210) # semi-translucent shiny tape
tape_highlight = (245, 230, 190, 230)
for y in range(16):
    top_img.putpixel((7, y), tape_color)
    top_img.putpixel((8, y), tape_highlight if y % 3 != 0 else tape_color)
    top_img.putpixel((9, y), tape_color)

# Shipping Label sticker in corner (top-left)
draw.rectangle([(1, 1), (5, 5)], fill=(245, 245, 240, 255))
# Barcode lines on sticker
draw.line([(2, 2), (2, 4)], fill=(30, 30, 30, 255))
draw.line([(3, 2), (3, 4)], fill=(30, 30, 30, 255))
draw.line([(4, 2), (4, 4)], fill=(120, 120, 120, 255))

# Red "FRAGILE" umbrella/glass mark (bottom right)
top_img.putpixel((12, 12), (200, 30, 30, 255))
top_img.putpixel((13, 12), (200, 30, 30, 255))
top_img.putpixel((14, 12), (200, 30, 30, 255))
top_img.putpixel((13, 13), (200, 30, 30, 255))
top_img.putpixel((13, 14), (200, 30, 30, 255))

top_img.save(os.path.join(rp_textures_blocks, "shipping_box_top.png"))

# 2. Shipping Box Side
side_img = create_cardboard_base(16, 16)
draw_side = ImageDraw.Draw(side_img)

# Top and Bottom bevel edges
for x in range(16):
    side_img.putpixel((x, 0), (210, 170, 120, 255))
    side_img.putpixel((x, 15), (110, 75, 40, 255))

# Vertical cardboard corner edges
for y in range(16):
    side_img.putpixel((0, y), (200, 160, 110, 255))
    side_img.putpixel((15, y), (120, 85, 50, 255))

# Horizontal flap line near top (row 3)
draw_side.line([(0, 3), (15, 3)], fill=(110, 75, 40, 255))

# Tape around center or top edge
for x in range(16):
    side_img.putpixel((x, 3), (225, 205, 160, 220))
    side_img.putpixel((x, 4), (235, 215, 170, 220) if x % 2 == 0 else (215, 195, 150, 220))

# Shipping stamp / arrows "THIS SIDE UP" on side
# Black up arrows
draw_side.line([(4, 10), (4, 12)], fill=(40, 40, 40, 255))
draw_side.line([(8, 10), (8, 12)], fill=(40, 40, 40, 255))
side_img.putpixel((3, 11), (40, 40, 40, 255))
side_img.putpixel((5, 11), (40, 40, 40, 255))
side_img.putpixel((7, 11), (40, 40, 40, 255))
side_img.putpixel((9, 11), (40, 40, 40, 255))

# Large barcode label on right side
draw_side.rectangle([(10, 8), (14, 13)], fill=(240, 240, 235, 255))
draw_side.line([(11, 9), (11, 12)], fill=(20, 20, 20, 255))
draw_side.line([(12, 9), (12, 12)], fill=(180, 180, 180, 255))
draw_side.line([(13, 9), (13, 12)], fill=(20, 20, 20, 255))

side_img.save(os.path.join(rp_textures_blocks, "shipping_box_side.png"))

# 3. Bubble Wrap Item Texture (16x16)
bw_img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
# Clear translucent sheet with shiny plastic bubbles
for y in range(2, 14):
    for x in range(2, 14):
        # Translucent plastic background sheet
        bw_img.putpixel((x, y), (220, 240, 255, 100))

# Add rows of round bubbles
bubble_centers = [(4, 4), (8, 4), (12, 4),
                  (6, 7), (10, 7),
                  (4, 10), (8, 10), (12, 10)]

for bx, by in bubble_centers:
    # Bubble outline
    for dx in range(-1, 2):
        for dy in range(-1, 2):
            if abs(dx) + abs(dy) == 1:
                bw_img.putpixel((bx + dx, by + dy), (160, 200, 230, 200))
    # Bubble center light
    bw_img.putpixel((bx, by), (240, 250, 255, 240))
    # Specular shine spot top-left
    bw_img.putpixel((bx - 1, by - 1), (255, 255, 255, 255))

bw_img.save(os.path.join(rp_textures_items, "bubble_wrap.png"))

# 4. Shipping Box Item Icon (16x16)
item_box = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
draw_ib = ImageDraw.Draw(item_box)

# 3D isometric cardboard box item icon
# Top face
top_pts = [(8, 1), (14, 4), (8, 7), (2, 4)]
draw_ib.polygon(top_pts, fill=(210, 170, 120, 255))

# Left face
left_pts = [(2, 4), (8, 7), (8, 14), (2, 11)]
draw_ib.polygon(left_pts, fill=(160, 120, 75, 255))

# Right face
right_pts = [(8, 7), (14, 4), (14, 11), (8, 14)]
draw_ib.polygon(right_pts, fill=(135, 95, 55, 255))

# Seams & Tape on top face
draw_ib.line([(8, 1), (8, 7)], fill=(240, 220, 180, 255), width=1) # tape

# Barcode on left face
draw_ib.rectangle([(4, 7), (6, 9)], fill=(240, 240, 240, 255))
draw_ib.line([(5, 7), (5, 9)], fill=(30, 30, 30, 255))

# Black outline around box
outline_pts = [(8, 0), (15, 4), (15, 11), (8, 15), (1, 11), (1, 4)]
for i in range(len(outline_pts)):
    p1 = outline_pts[i]
    p2 = outline_pts[(i+1)%len(outline_pts)]
    draw_ib.line([p1, p2], fill=(40, 25, 15, 255))

item_box.save(os.path.join(rp_textures_items, "shipping_box.png"))

print("Textures generated successfully!")
