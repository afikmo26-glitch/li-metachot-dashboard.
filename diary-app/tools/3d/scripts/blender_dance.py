# blender_dance.py: run inside Blender, or headless: blender -b --python blender_dance.py
# Builds a looping 'dance' clip (48 frames @ 24fps = 2 s, four beats) on the dragon rig on top of idle frame 0,
# the same way blender_run.py builds 'run' (bones turned about world axes: +x forward, +y the fighter's left,
# +z up), and exports the armature with only that clip to OUT. Then, as for run: rename the clip to 'dance',
# retarget.mjs OUT <model>.glb tmp.glb, BOB=0.05 BOBS=4 addclip.mjs tmp.glb dance <model>.glb.
import bpy, os, math, tempfile
from mathutils import Matrix, Vector

REPO = os.environ.get("DIARY_APP", r"C:\Users\אמיר\OneDrive\Documentos\li-metachot-dashboard\diary-app")
SRC = os.path.join(REPO, "assets", "sim3d", "dragon.glb")
OUT = os.path.join(tempfile.gettempdir(), "runwork", "dance_donor.glb")
N = 48

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in sc.objects if o.type == "ARMATURE")
ad = arm.animation_data or arm.animation_data_create()
sc.render.fps = 24

ad.action = bpy.data.actions["idle"]
if bpy.data.actions["idle"].slots:
    ad.action_slot = bpy.data.actions["idle"].slots[0]
sc.frame_set(0)
base = {pb.name: pb.matrix_basis.copy() for pb in arm.pose.bones}


def depth(b):
    return 0 if b.parent is None else 1 + depth(b.parent)


order = sorted(arm.pose.bones, key=lambda pb: depth(pb.bone))


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 4, axis)


def deltas(p):
    beat = math.sin(2 * p)           # two sways a loop
    step = math.sin(p)               # one step each side a loop
    bounce = abs(math.sin(2 * p))    # knees dip on every beat
    wave = math.sin(4 * p)           # hands wave four times a loop
    lift_l = -20 * max(0.0, step)
    lift_r = -20 * max(0.0, -step)
    return {
        "Waist":       [("X", 9 * beat), ("Z", 14 * step)],
        "Spine02":     [("X", 6 * beat)],
        "Head":        [("Y", 8 * wave), ("X", -6 * beat)],
        "L_Thigh":     [("Y", lift_l - 6 * bounce)],
        "R_Thigh":     [("Y", lift_r - 6 * bounce)],
        "L_Calf":      [("Y", -2 * lift_l + 14 * bounce)],
        "R_Calf":      [("Y", -2 * lift_r + 14 * bounce)],
        "L_Foot":      [("Y", -0.5 * (-lift_l + 8 * bounce))],
        "R_Foot":      [("Y", -0.5 * (-lift_r + 8 * bounce))],
    }


def aims(p):
    """Both arms up over the head, waving out of step: bone name -> the way it should point."""
    wave = math.sin(4 * p)
    return {
        "L_Upperarm": Vector((0.05, 0.55 + 0.25 * wave, 1)).normalized(),
        "R_Upperarm": Vector((0.05, -0.55 + 0.25 * wave, 1)).normalized(),
        "L_Forearm": Vector((0.1, 0.15 + 0.45 * wave, 1)).normalized(),
        "R_Forearm": Vector((0.1, -0.15 + 0.45 * wave, 1)).normalized(),
    }


act = bpy.data.actions.new("dance")
act.use_fake_user = True
ad.action = act
for pb in arm.pose.bones:
    pb.rotation_mode = "QUATERNION"

for f in range(N + 1):
    p = 2 * math.pi * (f % N) / N
    sc.frame_set(f)
    for pb in arm.pose.bones:
        pb.matrix_basis = base[pb.name].copy()
    bpy.context.view_layer.update()
    d = deltas(p)
    aim = aims(p)
    for pb in order:
        if pb.name in aim:
            # turn the bone so it points where the dance wants it
            R = (pb.tail - pb.head).normalized().rotation_difference(aim[pb.name]).to_matrix().to_4x4()
        elif pb.name in d:
            R = Matrix.Identity(4)
            for ax, deg in d[pb.name]:
                R = rot(ax, deg) @ R
        else:
            continue
        h = pb.head.copy()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix
        bpy.context.view_layer.update()
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_quaternion", frame=f, group=pb.name)

# the last key copies the first, so the loop is seamless
for L in act.layers:
    for st in L.strips:
        for cb in st.channelbags:
            for fc in cb.fcurves:
                k = fc.keyframe_points
                k[-1].co.y = k[0].co.y
                for kp in k:
                    kp.interpolation = "LINEAR"
                fc.update()

sc.frame_start, sc.frame_end = 0, N
for o in sc.objects:
    o.select_set(o.type in ("ARMATURE", "MESH") and o.name != "Icosphere")
bpy.context.view_layer.objects.active = arm
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
    export_animations=True, export_animation_mode="ACTIVE_ACTIONS", export_force_sampling=True,
    export_frame_range=True, export_anim_single_armature=True, export_def_bones=False)
print("exported", OUT)
