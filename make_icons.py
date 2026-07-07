from PIL import Image, ImageDraw

def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 따뜻한 주황 배경 (꽉 채움 = maskable 안전)
    d.rectangle([0, 0, size, size], fill=(234, 88, 12, 255))  # #EA580C

    s = size / 512.0
    # 흰색 장바구니 몸통
    bx0, by0, bx1, by1 = 150*s, 210*s, 362*s, 400*s
    r = 26*s
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=r, fill=(255, 255, 255, 255))
    # 손잡이 (반원 아치)
    hw = 12*s
    d.arc([196*s, 150*s, 316*s, 270*s], start=180, end=360, fill=(255, 255, 255, 255), width=int(hw))
    # 가운데 하트 (돌봄 = 손주 느낌)
    cx, cy = size/2, 320*s
    hs = 46*s
    d.ellipse([cx-hs, cy-hs*0.7, cx, cy+hs*0.3], fill=(234, 88, 12, 255))
    d.ellipse([cx, cy-hs*0.7, cx+hs, cy+hs*0.3], fill=(234, 88, 12, 255))
    d.polygon([cx-hs, cy-hs*0.15, cx+hs, cy-hs*0.15, cx, cy+hs*0.95], fill=(234, 88, 12, 255))

    img.convert("RGB").save(f"icons/icon-{size}.png")
    print(f"icon-{size}.png saved")

make(192)
make(512)
