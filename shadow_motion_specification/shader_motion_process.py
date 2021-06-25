# https://blender.stackexchange.com/questions/3527/how-to-read-pixels-of-a-video-from-python-api
# sudo flatpak override org.blender.Blender --talk-name=org.freedesktop.Flatpak
# flatpak run org.blender.Blender --background --python `pwd`/shader_motion_process.py -- `pwd`/../../devouring-devouring.mp4

import bpy
import sys

argv = sys.argv
argv = argv[argv.index("--") + 1:]  # get all args after "--"

frameStart = 1
frameEnd = 2 #695296
frameStep = 1
viewer_area = None
viewer_space = None

if viewer_area == None:
    viewer_area = bpy.context.screen.areas[0]
    viewer_area.type = "IMAGE_EDITOR"

for space in viewer_area.spaces:
    if space.type == "IMAGE_EDITOR":
        viewer_space = space

path = argv[0]
img = bpy.data.images.load(path)
w = img.size[0]
h = img.size[1]
viewer_space.image = img

frame = 1
for frame in range(frameStart, frameEnd, frameStep):
    print(w)
    print(h)
    viewer_space.image_user.frame_offset = frame
    # Toggle to refresh
    viewer_space.display_channels = 'COLOR_ALPHA'
    viewer_space.display_channels = 'COLOR'
    pixels = list(viewer_space.image.pixels)
    tmp = bpy.data.images.new(name="sample"+str(frame), width=w, height=h, alpha=False, float_buffer=False)
    tmp.pixels = pixels
    target = [0, 0] # X, Y
    index = ( target[1] * w + target[0] ) * 4
    print ("G: ", tmp.pixels[index + 1])
    print ("R: ", tmp.pixels[index])
    print ("B: ", tmp.pixels[index + 2])

img.user_clear()