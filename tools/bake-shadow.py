"""Bake the soft studio shadow that sits under the car on the page.

Run after prep-model.mjs (see `npm run model`):
  blender -b --python tools/bake-shadow.py -- build/gls-clean.glb public/models/gls-shadow.jpg

Renders a top-down orthographic view in Cycles with the car invisible to the
camera and a shadow-catcher floor, lit by an even white sky plus a large
overhead softbox. The shadow's opacity is written out as a greyscale JPEG
(white = full shadow), which the page uses as an alpha map on a floor plane
sized SHADOW_W x SHADOW_L metres. Image top is the back of the car.
"""

import os
import sys

import bpy
import numpy as np

SHADOW_W, SHADOW_L = 3.6, 6.8  # metres; keep in sync with src/showroom.js
PX_PER_M = 200
src, out = sys.argv[sys.argv.index("--") + 1 :][:2]
tmp = os.path.join(os.path.dirname(os.path.abspath(out)), "_shadow.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception:
    scene.cycles.device = "CPU"
scene.cycles.samples = 256
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.resolution_x = int(SHADOW_W * PX_PER_M)
scene.render.resolution_y = int(SHADOW_L * PX_PER_M)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"

for ob in bpy.data.objects:
    if ob.type == "MESH":
        ob.visible_camera = False

bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0))
floor = bpy.context.active_object
floor.scale = (SHADOW_W, SHADOW_L, 1)
floor.is_shadow_catcher = True

world = bpy.data.worlds.new("even-sky")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world

light = bpy.data.lights.new("softbox", type="AREA")
light.shape = "RECTANGLE"
light.size, light.size_y = 3.0, 6.0
light.energy = 900
softbox = bpy.data.objects.new("softbox", light)
softbox.location = (0, 0, 4.5)
scene.collection.objects.link(softbox)

cam = bpy.data.objects.new("top", bpy.data.cameras.new("top"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(SHADOW_W, SHADOW_L)
cam.location = (0, 0, 10)
scene.collection.objects.link(cam)
scene.camera = cam

scene.render.filepath = tmp
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(tmp)
w, h = img.size
px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
alpha = px[:, :, 3]
# Fade the last few percent at the edges so the plane never shows a hard border.
yy, xx = np.mgrid[0:h, 0:w]
edge = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]).astype(np.float32)
alpha *= np.clip(edge / (0.08 * min(w, h)), 0, 1)
grey = np.dstack([alpha, alpha, alpha, np.ones_like(alpha)])

outimg = bpy.data.images.new("shadow", width=w, height=h, alpha=False)
outimg.pixels = grey.ravel()
outimg.filepath_raw = out
outimg.file_format = "JPEG"
scene.render.image_settings.quality = 88
outimg.save()
os.remove(tmp)
print("SHADOW", out, w, h, "max", float(alpha.max()))
