"""Re-encode the studio HDRI as a half-float DWAA EXR (about 1/6 the size).

  blender -b --python tools/pack-hdri.py -- source/studio_small_09_2k.hdr public/env/studio.exr [width]

An optional width scales it down first (phones get a 1024-wide copy).

studio_small_09 is by Poly Haven (polyhaven.com), CC0.
"""

import sys

import bpy

args = sys.argv[sys.argv.index("--") + 1 :]
src, out = args[:2]
img = bpy.data.images.load(src)
if len(args) > 2:
    width = int(args[2])
    img.scale(width, width // 2)
settings = bpy.context.scene.render.image_settings
settings.file_format = "OPEN_EXR"
settings.color_depth = "16"
settings.exr_codec = "DWAA"
img.save_render(out, scene=bpy.context.scene)
print("PACKED", out, tuple(img.size))
