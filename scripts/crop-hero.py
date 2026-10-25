#!/usr/bin/env python3
"""把抓到的原图居中裁剪成正方形并缩放到 256x256，规格与现有人物图一致。

    python scripts/crop-hero.py <原图> <输出.png> [fit|contain]

fit（默认）：先按「覆盖」缩放再居中裁切，输出满幅 256x256。
contain：按「包含」缩放后补黑边到 256x256。竖长立绘（人物全身图）用 fit 会把头裁掉，
    所以这类图用 contain，保留完整角色。

只做裁剪与缩放，不做任何生成/绘制。输出统一为 256x256 RGB PNG。
"""

import sys

from PIL import Image, ImageOps

SIZE = 256


def main():
    src, dst = sys.argv[1], sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else "fit"
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    im = im.convert("RGB")
    if mode == "contain":
        # 竖长立绘：按包含缩放后补黑边，保证角色全身/头部不被裁掉
        fitted = ImageOps.contain(im, (SIZE, SIZE), method=Image.LANCZOS)
        canvas = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
        canvas.paste(fitted, ((SIZE - fitted.width) // 2, (SIZE - fitted.height) // 2))
        im = canvas
    else:
        # B 站封面是 16:9，直接拉伸会变形，所以先居中裁成正方形再缩放
        im = ImageOps.fit(im, (SIZE, SIZE), method=Image.LANCZOS, centering=(0.5, 0.4))
    im.save(dst, "PNG", optimize=True)


if __name__ == "__main__":
    main()
