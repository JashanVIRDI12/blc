# Read one glyph's outline from a TrueType font: cmap (format 4) -> glyph id,
# loca + glyf -> contours of on/off-curve points -> path commands in font
# units (y up). Prints JSON: { unitsPerEm, advance, bounds, path: [[cmd, ...pts]] }.
import json, struct, sys

def read(path):
    data = open(path, 'rb').read()
    num = struct.unpack('>H', data[4:6])[0]
    tables = {}
    for i in range(num):
        tag, _, off, length = struct.unpack('>4sIII', data[12 + i * 16: 28 + i * 16])
        tables[tag.decode()] = (off, length)
    return data, tables

def glyph_id(data, tables, char):
    off, _ = tables['cmap']
    n = struct.unpack('>H', data[off + 2: off + 4])[0]
    for i in range(n):
        pid, eid, sub = struct.unpack('>HHI', data[off + 4 + i * 8: off + 12 + i * 8])
        s = off + sub
        if struct.unpack('>H', data[s:s + 2])[0] != 4: continue
        segx2 = struct.unpack('>H', data[s + 6:s + 8])[0]; seg = segx2 // 2
        ends = struct.unpack('>%dH' % seg, data[s + 14: s + 14 + segx2])
        starts = struct.unpack('>%dH' % seg, data[s + 16 + segx2: s + 16 + 2 * segx2])
        deltas = struct.unpack('>%dh' % seg, data[s + 16 + 2 * segx2: s + 16 + 3 * segx2])
        ro_off = s + 16 + 3 * segx2
        ranges = struct.unpack('>%dH' % seg, data[ro_off: ro_off + segx2])
        c = ord(char)
        for k in range(seg):
            if starts[k] <= c <= ends[k]:
                if ranges[k] == 0: return (c + deltas[k]) & 0xFFFF
                addr = ro_off + k * 2 + ranges[k] + (c - starts[k]) * 2
                g = struct.unpack('>H', data[addr:addr + 2])[0]
                return (g + deltas[k]) & 0xFFFF if g else 0
    raise SystemExit('no glyph')

def outline(data, tables, gid):
    head = tables['head'][0]
    upem = struct.unpack('>H', data[head + 18: head + 20])[0]
    long_loca = struct.unpack('>h', data[head + 50: head + 52])[0] == 1
    loca = tables['loca'][0]
    if long_loca: start, end = struct.unpack('>II', data[loca + gid * 4: loca + gid * 4 + 8])
    else: start, end = [v * 2 for v in struct.unpack('>HH', data[loca + gid * 2: loca + gid * 2 + 4])]
    g = tables['glyf'][0] + start
    ncont, xmin, ymin, xmax, ymax = struct.unpack('>hhhhh', data[g:g + 10])
    if ncont < 0: raise SystemExit('composite glyph')
    p = g + 10
    ends = struct.unpack('>%dH' % ncont, data[p:p + 2 * ncont]); p += 2 * ncont
    ilen = struct.unpack('>H', data[p:p + 2])[0]; p += 2 + ilen
    npts = ends[-1] + 1
    flags = []
    while len(flags) < npts:
        f = data[p]; p += 1; flags.append(f)
        if f & 8:
            r = data[p]; p += 1; flags.extend([f] * r)
    def coords(short, same):
        out, v = [], 0
        nonlocal p
        for f in flags:
            if f & short:
                d = data[p]; p += 1; v += d if f & same else -d
            elif not f & same:
                v += struct.unpack('>h', data[p:p + 2])[0]; p += 2
            out.append(v)
        return out
    xs = coords(2, 16); ys = coords(4, 32)
    # hmtx advance
    hhea = tables['hhea'][0]; nmetrics = struct.unpack('>H', data[hhea + 34: hhea + 36])[0]
    hmtx = tables['hmtx'][0]; idx = min(gid, nmetrics - 1)
    advance = struct.unpack('>H', data[hmtx + idx * 4: hmtx + idx * 4 + 2])[0]
    path, s = [], 0
    for e in ends:
        pts = [(xs[i], ys[i], bool(flags[i] & 1)) for i in range(s, e + 1)]; s = e + 1
        # Start on an on-curve point (or the midpoint of two off-curve ones).
        if not pts[0][2]:
            if pts[-1][2]: pts = [pts[-1]] + pts[:-1]
            else: pts = [((pts[0][0] + pts[-1][0]) / 2, (pts[0][1] + pts[-1][1]) / 2, True)] + pts
        path.append(['M', pts[0][0], pts[0][1]])
        seq = pts[1:] + [pts[0]]
        i = 0
        prev_off = None
        for x, y, on in seq:
            if on:
                if prev_off: path.append(['Q', prev_off[0], prev_off[1], x, y]); prev_off = None
                else: path.append(['L', x, y])
            else:
                if prev_off:
                    mx, my = (prev_off[0] + x) / 2, (prev_off[1] + y) / 2
                    path.append(['Q', prev_off[0], prev_off[1], mx, my])
                prev_off = (x, y)
        if prev_off: path.append(['Q', prev_off[0], prev_off[1], pts[0][0], pts[0][1]])
        path.append(['Z'])
    return {'unitsPerEm': upem, 'advance': advance, 'bounds': [xmin, ymin, xmax, ymax], 'path': path}

data, tables = read(sys.argv[1])
out = {}
for ch in sys.argv[2]:
    out[ch] = outline(data, tables, glyph_id(data, tables, ch))
print(json.dumps(out))
