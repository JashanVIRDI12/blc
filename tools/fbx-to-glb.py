# Convert an FBX car (with its textures beside it) to a GLB for tools/prep-fleet.mjs.
#   blender -b --python tools/fbx-to-glb.py -- "source/i7/BMW i7 M70.FBX" build/i7-raw.glb
import bpy, os, sys
src, out = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.abspath(src))
# Textures were authored elsewhere: find them in the FBX's own folder.
bpy.ops.file.find_missing_files(directory=os.path.dirname(os.path.abspath(src)))
# The FBX carries a normal per face: shade smooth, keeping creases sharper
# than 35 degrees (panel lines, lamp edges) crisp.
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.shade_auto_smooth(angle=0.61)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_apply=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO')
