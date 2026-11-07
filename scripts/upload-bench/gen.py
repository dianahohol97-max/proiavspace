import numpy as np, sys, os
from PIL import Image
def img(seed, w, h, noise):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    base = np.stack([
        128+100*np.sin(x/(300+seed*7)+seed),
        128+100*np.cos(y/(250+seed*5)),
        128+90*np.sin((x+y)/(400+seed*3)),
    ], -1)
    base += rng.normal(0, noise, base.shape).astype(np.float32)
    return Image.fromarray(np.clip(base,0,255).astype(np.uint8))
kind=sys.argv[1]; n=int(sys.argv[2])
for i in range(n):
    if kind=='png':
        im = img(i, 4800, 3200, 3.6)
        im.save(f'data/png/shot_{i:02d}.png', compress_level=6)
    else:
        im = img(i, 7200, 4800, 9)
        im.save(f'data/jpg/shot_{i:02d}.jpg', quality=97)
    print(kind, i, os.path.getsize(f'data/{kind}/shot_{i:02d}.{kind}')//1024//1024, 'MB', flush=True)
