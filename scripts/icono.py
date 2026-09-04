from PIL import Image, ImageDraw
import math

BG=(14,13,12); FELT=(23,36,30); RING=(58,92,76)
BRASS=(205,166,86); BONE=(244,239,229); MUTED=(120,114,102)

def make(size, path, safe=1.0, bg=BG):
    S = size*8
    im = Image.new("RGB", (S,S), bg)
    d = ImageDraw.Draw(im)
    cx = cy = S/2
    k = safe  # factor de zona segura para maskable

    rx, ry = S*0.315*k, S*0.235*k
    d.ellipse([cx-rx-S*0.055*k, cy-ry-S*0.055*k, cx+rx+S*0.055*k, cy+ry+S*0.055*k], fill=FELT)
    d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], outline=RING, width=int(S*0.011))

    n = 9
    seat_r = S*0.042*k
    hero_r = S*0.062*k
    for i in range(n):
        t = math.pi/2 + i*2*math.pi/n
        x = cx + rx*math.cos(t)
        y = cy + ry*math.sin(t)
        if i == 0:
            d.ellipse([x-hero_r, y-hero_r, x+hero_r, y+hero_r], fill=BRASS)
        else:
            d.ellipse([x-seat_r, y-seat_r, x+seat_r, y+seat_r], fill=MUTED)

    # disco del repartidor, entre el asiento del hero y el siguiente
    t = math.pi/2 - 0.62
    bx = cx + rx*0.98*math.cos(t)
    by = cy + ry*0.98*math.sin(t)
    br = S*0.05*k
    d.ellipse([bx-br, by-br, bx+br, by+br], fill=BONE)

    im.resize((size,size), Image.LANCZOS).save(path)

make(192, "public/icon-192.png")
make(512, "public/icon-512.png")
make(180, "public/apple-touch-icon.png")
make(512, "public/icon-maskable.png", safe=0.72)
print("iconos listos")
