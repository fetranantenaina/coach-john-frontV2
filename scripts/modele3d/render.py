import bpy, sys, math, colorsys, mathutils
a = sys.argv[sys.argv.index("--")+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
codes = sorted({o.name.rsplit("_",1)[0] for o in bpy.data.objects if o.type=="MESH" and o.name not in ("contexte","silhouette")})
for o in bpy.data.objects:
    if o.type!="MESH": continue
    if o.name=="silhouette": o.hide_render=True; continue
    if o.name=="contexte": o.color=(0.6,0.6,0.6,1); continue
    i=codes.index(o.name.rsplit("_",1)[0]); r,g,b=colorsys.hsv_to_rgb(i/len(codes),0.75,0.95); o.color=(r,g,b,1)
sc=bpy.context.scene; sc.render.engine="BLENDER_WORKBENCH"; sc.display.shading.color_type="OBJECT"
sc.render.resolution_x=500; sc.render.resolution_y=900
cam=bpy.data.objects.new("cam",bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera=cam
cam.data.type="ORTHO"; cam.data.ortho_scale=1.95
for nom,y,rz in (("face",-5,0),("dos",5,math.pi),("cote",0,0)):
    if nom=="cote": cam.location=(5,0,0.88); cam.rotation_euler=(math.pi/2,0,math.pi/2)
    else: cam.location=(0,y,0.88); cam.rotation_euler=(math.pi/2,0,rz)
    sc.render.filepath=a[1]+"_"+nom+".png"; bpy.ops.render.render(write_still=True)
print("CODES",codes)
