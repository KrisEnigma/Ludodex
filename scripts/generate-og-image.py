#!/usr/bin/env python3
"""
Generate public/og-image.png — the 1200x630 link-preview card (og:image /
twitter:image in index.html).

Requires Python 3 with Pillow and fontTools:
    pip3 install pillow fonttools
Run from the repo root:
    python3 scripts/generate-og-image.py

Design: Void palette + Space Mono (from node_modules/@fontsource/space-mono).
The highlighted grid path spells LUDODEX; the other tiles are filler so the
card never spoils a real puzzle. Colours mirror the .skin-void tokens in
src/skins/skins.css — update both if the palette changes.
"""
import os, tempfile
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_DIR = os.path.join(ROOT, 'node_modules', '@fontsource', 'space-mono', 'files')
OUT = os.path.join(ROOT, 'public', 'og-image.png')

# Pillow needs TTF; fontsource ships WOFF — convert into a temp dir.
_tmp = tempfile.mkdtemp(prefix='ludodex-og-')
FONT_700 = os.path.join(_tmp, 'spacemono-700.ttf')
FONT_400 = os.path.join(_tmp, 'spacemono-400.ttf')
for weight, path in (('700', FONT_700), ('400', FONT_400)):
    f = TTFont(os.path.join(FONT_DIR, f'space-mono-latin-{weight}-normal.woff'))
    f.flavor = None
    f.save(path)

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
S=2                      # supersample
W,H=1200*S,630*S
def hx(h,a=255): h=h.lstrip('#'); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16),a)
def lerp(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(4))
BG_TOP,BG_BOT=hx('#0d1118'),hx('#07090e')
TILE_A,TILE_B=hx('#1e2236'),hx('#131824')
SEL_A,SEL_B=hx('#0d3a42'),hx('#071e26')
BORDER,ACCENT=hx('#2a3148'),hx('#00d4e8')
TEXT,DIM,SEL_LETTER=hx('#cfd6e1'),hx('#8590a7'),hx('#9af0ff')
PATH0,PATH1=hx('#8a7bff'),hx('#00d4e8')
bold=lambda px: ImageFont.truetype(FONT_700, px*S)
reg =lambda px: ImageFont.truetype(FONT_400, px*S)

# Background: radial gradient + soft teal glow behind the grid
img=Image.new('RGBA',(W,H))
px=img.load()
cx,cy=W*0.5,H*0.35; R=math.hypot(W,H)*0.6
for y in range(0,H,2):
    for x in range(0,W,2):
        c=lerp(BG_TOP,BG_BOT,min(1,math.hypot(x-cx,y-cy)/R))
        px[x,y]=c; 
        if x+1<W: px[x+1,y]=c
        if y+1<H: px[x,y+1]=c; 
        if x+1<W and y+1<H: px[x+1,y+1]=c
# Grid geometry (right column)
T=96*S; GAP=12*S; RAD=17*S
GW=4*T+3*GAP
gx0=W-GW-100*S; gy0=(H-GW)//2
glow=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
gcx,gcy=gx0+GW//2,gy0+GW//2
gd.ellipse([gcx-GW*0.75,gcy-GW*0.75,gcx+GW*0.75,gcy+GW*0.75],fill=hx('#00d4e8',60))
glow=glow.filter(ImageFilter.GaussianBlur(120*S))
img=Image.alpha_composite(img,glow)

letters=["LUFA","PDOW","KEDH","XRYM"]
path=[(0,0),(1,0),(1,1),(2,1),(2,2),(1,2),(0,3)]   # L U D O D E X
onpath=set(path)
def center(c,r): return (gx0+c*(T+GAP)+T/2, gy0+r*(T+GAP)+T/2)

def tile(layer,c,r,sel):
    x0=gx0+c*(T+GAP); y0=gy0+r*(T+GAP)
    # vertical-ish gradient fill via mask
    a,b=(SEL_A,SEL_B) if sel else (TILE_A,TILE_B)
    grad=Image.new('RGBA',(T,T))
    gp=grad.load()
    for yy in range(T):
        for xx in range(T):
            gp[xx,yy]=lerp(a,b,(xx+yy)/(2*T))
    mask=Image.new('L',(T,T),0); ImageDraw.Draw(mask).rounded_rectangle([0,0,T-1,T-1],RAD,fill=255)
    layer.paste(grad,(int(x0),int(y0)),mask)
    ImageDraw.Draw(layer).rounded_rectangle([x0,y0,x0+T-1,y0+T-1],RAD,outline=ACCENT if sel else BORDER,width=(3 if sel else 2)*S)

# selected-tile glow
sg=Image.new('RGBA',(W,H),(0,0,0,0)); sd=ImageDraw.Draw(sg)
for (c,r) in path:
    x0=gx0+c*(T+GAP); y0=gy0+r*(T+GAP)
    sd.rounded_rectangle([x0,y0,x0+T,y0+T],RAD,fill=hx('#00d4e8',110))
sg=sg.filter(ImageFilter.GaussianBlur(16*S))
img=Image.alpha_composite(img,sg)

tiles=Image.new('RGBA',(W,H),(0,0,0,0))
for r in range(4):
    for c in range(4):
        tile(tiles,c,r,(c,r) in onpath)
img=Image.alpha_composite(img,tiles)

# Ribbon: gradient along the path, round joins, with a soft glow
pts=[center(c,r) for c,r in path]
segl=[math.dist(pts[i],pts[i+1]) for i in range(len(pts)-1)]; total=sum(segl)
def ribbon(width,alpha):
    lay=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    acc=0
    for i in range(len(pts)-1):
        (x0,y0),(x1,y1)=pts[i],pts[i+1]; n=max(2,int(segl[i]/(2*S)))
        for k in range(n):
            t0=k/n; t=(acc+segl[i]*t0)/total
            col=lerp(PATH0,PATH1,t); col=(col[0],col[1],col[2],alpha)
            xa,ya=x0+(x1-x0)*t0, y0+(y1-y0)*t0
            d.ellipse([xa-width/2,ya-width/2,xa+width/2,ya+width/2],fill=col)
        acc+=segl[i]
    xe,ye=pts[-1]; col=PATH1[:3]+(alpha,)
    d.ellipse([xe-width/2,ye-width/2,xe+width/2,ye+width/2],fill=col)
    return lay
img=Image.alpha_composite(img,ribbon(28*S,140).filter(ImageFilter.GaussianBlur(12*S)))
img=Image.alpha_composite(img,ribbon(15*S,235))

# Letters above the ribbon (as in the game), outlined for crispness
ld=ImageDraw.Draw(img); lf=bold(46)
for r in range(4):
    for c in range(4):
        ch=letters[r][c]; sel=(c,r) in onpath
        x,y=center(c,r)
        ld.text((x,y),ch,font=lf,anchor='mm',fill=SEL_LETTER if sel else TEXT,
                stroke_width=(4*S if sel else 0),stroke_fill=hx('#071e26'))

# Left column: wordmark + tagline
tx=100*S
word="LUDODEX"; wf=bold(76); spacing=int(76*S*0.18)
# measure with tracking
widths=[ld.textlength(ch,font=wf) for ch in word]
wy=H//2-40*S
wl=Image.new('RGBA',(W,H),(0,0,0,0)); wd=ImageDraw.Draw(wl)
x=tx
for ch,wch in zip(word,widths):
    wd.text((x,wy),ch,font=wf,fill=hx('#00d4e8',255),anchor='ls'); x+=wch+spacing
img=Image.alpha_composite(img,wl.filter(ImageFilter.GaussianBlur(14*S)))
ld=ImageDraw.Draw(img); x=tx
for ch,wch in zip(word,widths):
    ld.text((x,wy),ch,font=wf,fill=hx('#e6f9fc'),anchor='ls'); x+=wch+spacing
ld.text((tx+4*S,wy+62*S),"A daily word puzzle for gamers",font=reg(28),fill=TEXT,anchor='ls')
ld.text((tx+4*S,wy+108*S),"NEW PUZZLE EVERY DAY",font=bold(20),fill=DIM,anchor='ls')
# small accent rule
ld.rounded_rectangle([tx+4*S,wy+140*S,tx+64*S,wy+146*S],3*S,fill=ACCENT)

tag_w=ld.textlength("A daily word puzzle for gamers",font=reg(28))
word_w=sum(widths)+spacing*(len(word)-1)
print('wordmark right edge', (tx+word_w)/S, '| tagline right edge', (tx+4*S+tag_w)/S, '| grid left', gx0/S)
out=img.convert('RGB').resize((1200,630),Image.LANCZOS)
out.save(OUT, optimize=True)
print('saved', os.path.relpath(OUT, ROOT), out.size)
