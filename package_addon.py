import json
import os
import zipfile

def verify_json(filepath):
    print(f"Checking JSON syntax: {filepath}")
    with open(filepath, 'r') as f:
        json.load(f)
    print(" -> OK!")

json_files = [
    "realistic_unboxing_bp/manifest.json",
    "realistic_unboxing_bp/blocks/shipping_box.json",
    "realistic_unboxing_bp/items/shipping_box.json",
    "realistic_unboxing_bp/items/bubble_wrap.json",
    "realistic_unboxing_rp/manifest.json",
    "realistic_unboxing_rp/textures/terrain_texture.json",
    "realistic_unboxing_rp/textures/item_texture.json",
    "realistic_unboxing_rp/blocks.json",
    "realistic_unboxing_rp/texts/languages.json",
]

for jf in json_files:
    verify_json(jf)

# Build .mcpack and .mcaddon archives
bp_zip = "realistic_unboxing_bp.mcpack"
rp_zip = "realistic_unboxing_rp.mcpack"
mcaddon = "realistic_unboxing.mcaddon"

def zip_folder(folder, zip_filename):
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(folder):
            for file in files:
                filepath = os.path.join(root, file)
                arcname = os.path.relpath(filepath, folder)
                zipf.write(filepath, arcname)

zip_folder("realistic_unboxing_bp", bp_zip)
zip_folder("realistic_unboxing_rp", rp_zip)

with zipfile.ZipFile(mcaddon, 'w', zipfile.ZIP_DEFLATED) as zipf:
    zipf.write(bp_zip, bp_zip)
    zipf.write(rp_zip, rp_zip)

print(f"Created {mcaddon} successfully! Size: {os.path.getsize(mcaddon)} bytes.")
