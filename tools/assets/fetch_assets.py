"""Fetch, process and register AFTERIMAGE's third-party assets.

Build-time only. Needs Pillow (PYTHONPATH may point at a local install) and runs
@gltf-transform/cli through npx. Writes public/assets/** and assets.manifest.json.
Usage: python3 tools/assets/fetch_assets.py [--odd-tide /path/to/01-odd-tide]
"""

import argparse, datetime, hashlib, io, json, os, pathlib, shutil, subprocess, urllib.request, zipfile

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets"
CACHE = pathlib.Path(os.environ.get("ASSET_CACHE", "/tmp/afterimage-asset-cache"))
TODAY = datetime.date.today().isoformat()
UA = {"User-Agent": "afterimage-asset-fetch/1.0"}

# role: (source kind, id, output size, note)
TEXTURES = {
    "copper": ("ambientcg", "Metal047B", 1024, "Copper boilers and pipes: dirty copper with smudges"),
    "patina": ("ambientcg", "Metal058B", 512, "Oxidised copper for recesses, flanges and bands"),
    "brass": ("ambientcg", "Metal048B", 1024, "Brass fittings: worn gold scan, tinted to brass in the material"),
    "dome-plate": ("polyhaven", "metal_plate", 1024, "Riveted steel plates for the dome shell and shutter"),
    "shutter": ("polyhaven", "painted_metal_shutter", 512, "Painted shutter leaf and rails"),
    "floor": ("oddtide", "rough_concrete", 1024, "Observatory floor"),
    "deck": ("oddtide", "distressed_painted_planks", 1024, "Sky Deck planks"),
    "blanket": ("oddtide", "wool_boucle", 512, "Blankets on the Sky Deck"),
}
MODELS = {
    "projector": ("filmstrip_projector_8mm", "The projector at the head of the throw"),
    "pipe-lamp": ("industrial_pipe_lamp", "Lamp standards around the observatory floor"),
    "lantern": ("brass_diya_lantern", "Hanging brass lanterns on the Sky Deck"),
}
HDRI = ("boiler_room", "1k", "Environment reflections for metals and glass, dimmed to a night fill")


def get(url: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    key = CACHE / hashlib.sha1(url.encode()).hexdigest()
    if key.exists():
        return key.read_bytes()
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        data = r.read()
    key.write_bytes(data)
    return data


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def rel(p: pathlib.Path) -> str:
    return p.relative_to(ROOT).as_posix()


def out_record(paths):
    return [{"path": rel(p), "bytes": p.stat().st_size, "sha256": sha(p.read_bytes())} for p in paths]


def save_webp(img: Image.Image, path: pathlib.Path, size: int, quality: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.size[0] != size:
        img = img.resize((size, size), Image.LANCZOS)
    img.save(path, "WEBP", quality=quality, method=6)
    return path


def write_set(role: str, colour: Image.Image, normal: Image.Image, arm: Image.Image, size: int):
    folder = OUT / "textures" / role
    return [
        save_webp(colour.convert("RGB"), folder / "colour.webp", size, 84),
        save_webp(normal.convert("RGB"), folder / "normal.webp", size, 92),
        save_webp(arm.convert("RGB"), folder / "arm.webp", size, 90),
    ]


def ambientcg(role, asset_id, size, note):
    url = f"https://ambientcg.com/get?file={asset_id}_1K-JPG.zip"
    data = get(url)
    z = zipfile.ZipFile(io.BytesIO(data))
    def find(suffix):
        name = next((n for n in z.namelist() if n.endswith(suffix)), None)
        return Image.open(io.BytesIO(z.read(name))) if name else None
    colour, normal = find("_Color.jpg"), find("_NormalGL.jpg")
    rough, metal, ao = find("_Roughness.jpg"), find("_Metalness.jpg"), find("_AmbientOcclusion.jpg")
    w = colour.size[0]
    blank = lambda v: Image.new("L", (w, w), v)
    arm = Image.merge("RGB", [(ao or blank(255)).convert("L"), rough.convert("L"), (metal or blank(255)).convert("L")])
    files = write_set(role, colour, normal, arm, size)
    return {
        "id": f"texture-{role}", "title": f"ambientCG {asset_id}", "role": note,
        "sourceUrl": f"https://ambientcg.com/view?id={asset_id}", "downloadUrl": url,
        "author": "ambientCG (Lennart Demes)", "license": "CC0 1.0",
        "retrievalDate": TODAY, "originalSha256": sha(data),
        "processingSteps": ["1K JPG set", "packed AO/roughness/metalness into ARM (missing AO white, missing metalness white)",
                            f"resized to {size}px", "WebP (colour q84, normal q92, ARM q90)"],
        "outputFiles": out_record(files),
    }


def polyhaven_texture(role, asset_id, size, note):
    info = json.loads(get(f"https://api.polyhaven.com/info/{asset_id}"))
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    urls = {k: files[k]["1k"]["jpg"]["url"] for k in ("Diffuse", "nor_gl", "arm")}
    raw = {k: get(u) for k, u in urls.items()}
    imgs = {k: Image.open(io.BytesIO(v)) for k, v in raw.items()}
    out = write_set(role, imgs["Diffuse"], imgs["nor_gl"], imgs["arm"], size)
    return {
        "id": f"texture-{role}", "title": f"Poly Haven {info.get('name', asset_id)}", "role": note,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}", "downloadUrl": urls["Diffuse"],
        "author": ", ".join(info.get("authors", {}).keys()) or "Poly Haven", "license": "CC0 1.0",
        "retrievalDate": TODAY, "originalSha256": sha(raw["Diffuse"]),
        "processingSteps": ["1K JPG diffuse / nor_gl / arm", f"resized to {size}px", "WebP (colour q84, normal q92, ARM q90)"],
        "outputFiles": out_record(out),
    }


def oddtide_texture(role, set_id, size, note, odd):
    folder = pathlib.Path(odd) / "public" / "textures" / set_id
    pick = lambda kind: next(folder.glob(f"{set_id}_{kind}_*.jpg"))
    src = {k: pick(k) for k in ("diff", "nor_gl", "arm")}
    out = write_set(role, *(Image.open(src[k]) for k in ("diff", "nor_gl", "arm")), size)
    manifest = json.loads((pathlib.Path(odd) / "assets.manifest.json").read_text())
    upstream = next((a for a in manifest["assets"] if any(set_id in f["path"] for f in a.get("outputFiles", []))), {})
    return {
        "id": f"texture-{role}", "title": upstream.get("title", set_id), "role": note,
        "sourceUrl": upstream.get("sourceUrl", f"https://polyhaven.com/a/{set_id}"),
        "author": upstream.get("author", "Poly Haven"), "license": upstream.get("license", "CC0 1.0"),
        "retrievalDate": upstream.get("retrievalDate"), "originalSha256": upstream.get("originalSha256"),
        "via": "Copied from the ODD TIDE repository (01-odd-tide, public/textures) with its manifest record, as authorised",
        "processingSteps": [*upstream.get("processingSteps", []), f"ODD TIDE 1K JPG re-encoded to WebP at {size}px"],
        "outputFiles": out_record(out),
    }


def polyhaven_model(role, asset_id, note):
    info = json.loads(get(f"https://api.polyhaven.com/info/{asset_id}"))
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))
    g = files["gltf"]["1k"]["gltf"]
    work = CACHE / f"model-{asset_id}"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    main = get(g["url"])
    (work / f"{asset_id}.gltf").write_bytes(main)
    for rel_path, meta in g.get("include", {}).items():
        target = work / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(get(meta["url"]))
    out = OUT / "models" / f"{role}.glb"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["npx", "-y", "@gltf-transform/cli@4.5.0", "optimize", str(work / f"{asset_id}.gltf"), str(out),
                    "--compress", "meshopt", "--texture-compress", "webp", "--texture-size", "1024"], check=True)
    return {
        "id": f"model-{role}", "title": f"Poly Haven {info.get('name', asset_id)}", "role": note,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}", "downloadUrl": g["url"],
        "author": ", ".join(info.get("authors", {}).keys()) or "Poly Haven", "license": "CC0 1.0",
        "retrievalDate": TODAY, "originalSha256": sha(main),
        "processingSteps": ["1K glTF with textures", "gltf-transform 4.5.0 optimize: meshopt geometry, WebP textures ≤1024px"],
        "outputFiles": out_record([out]),
    }


def hdri():
    asset_id, res, note = HDRI
    info = json.loads(get(f"https://api.polyhaven.com/info/{asset_id}"))
    url = json.loads(get(f"https://api.polyhaven.com/files/{asset_id}"))["hdri"][res]["hdr"]["url"]
    data = get(url)
    out = OUT / "hdri" / f"{asset_id}_{res}.hdr"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    return {
        "id": "hdri-environment", "title": f"Poly Haven {info.get('name', asset_id)}", "role": note,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}", "downloadUrl": url,
        "author": ", ".join(info.get("authors", {}).keys()) or "Poly Haven", "license": "CC0 1.0",
        "retrievalDate": TODAY, "originalSha256": sha(data),
        "processingSteps": [f"{res} Radiance HDR, unmodified; prefiltered at runtime with PMREM"],
        "outputFiles": out_record([out]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--odd-tide", default="/home/user/01-odd-tide")
    args = ap.parse_args()
    shutil.rmtree(OUT, ignore_errors=True)
    assets = []
    for role, (kind, asset_id, size, note) in TEXTURES.items():
        if kind == "ambientcg":
            assets.append(ambientcg(role, asset_id, size, note))
        elif kind == "polyhaven":
            assets.append(polyhaven_texture(role, asset_id, size, note))
        else:
            assets.append(oddtide_texture(role, asset_id, size, note, args.odd_tide))
        print("texture", role)
    for role, (asset_id, note) in MODELS.items():
        assets.append(polyhaven_model(role, asset_id, note))
        print("model", role)
    assets.append(hdri())
    total = sum(f["bytes"] for a in assets for f in a["outputFiles"])
    manifest = {
        "schemaVersion": 1,
        "project": "03-afterimage",
        "policy": "Third-party assets are CC0 only (Poly Haven, ambientCG; ODD TIDE copies keep their upstream records). Audio is listed in README credits.",
        "totalBytes": total,
        "assets": assets,
    }
    (ROOT / "assets.manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print("total MB", round(total / 1e6, 2))


if __name__ == "__main__":
    main()
