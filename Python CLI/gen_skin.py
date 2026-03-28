#!/usr/bin/env python3
"""
gen_skin.py - Generate Delta Skin from Figma design via Figma REST API.

Usage:
    gen_skin <figma_url> [--output-dir <dir>] [--token <token>]

Environment:
    FIGMA_TOKEN - Figma personal access token for API authentication

Example:
    gen_skin "https://www.figma.com/design/wBoJTqcDwqoWk7pbQY611D/皮肤?node-id=16952-1104"
"""

import sys
import os
import json
import zipfile
import requests

from skin_common import (
    parse_figma_url,
    find_by_name,
    build_info,
    discover_layers,
)


# ---------------------------------------------------------------------------
# Figma REST API helpers
# ---------------------------------------------------------------------------


def figma_get(endpoint, token):
    """GET from Figma API and return parsed JSON with retry."""
    import time
    url = f"https://api.figma.com/v1{endpoint}"
    for attempt in range(3):
        try:
            resp = requests.get(url, headers={"X-Figma-Token": token}, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            if attempt < 2:
                wait = 2 ** attempt
                print(f"    [RETRY] Figma API failed, waiting {wait}s... ({exc})")
                time.sleep(wait)
            else:
                raise RuntimeError(f"Figma API failed after 3 attempts: {exc}") from exc


def export_node_pdf(file_key, node_id, dest_path, token):
    """Export a single node as PDF and save to *dest_path* with retry."""
    import time
    safe_id = requests.utils.quote(node_id, safe="")
    data = figma_get(f"/images/{file_key}?ids={safe_id}&format=pdf", token)
    image_url = data.get("images", {}).get(node_id)
    if not image_url:
        print(f"  [WARN] No PDF URL returned for node {node_id}")
        return False

    for attempt in range(3):
        try:
            resp = requests.get(image_url, timeout=60)
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return True
        except Exception as exc:
            if attempt < 2:
                wait = 2 ** attempt
                print(f"    [RETRY] download failed, waiting {wait}s... ({exc})")
                time.sleep(wait)
            else:
                raise RuntimeError(f"Download failed after 3 attempts: {exc}") from exc
    return False


# ---------------------------------------------------------------------------
# Main workflow
# ---------------------------------------------------------------------------


def generate_skin(figma_url, output_dir, token, skin_type="manic"):
    file_key, node_id = parse_figma_url(figma_url)
    print(f"Figma file: {file_key}  node: {node_id}")

    # Fetch node tree
    print("Fetching design data from Figma API...")
    data = figma_get(
        f"/files/{file_key}/nodes?ids={requests.utils.quote(node_id, safe='')}",
        token,
    )

    node_data = data.get("nodes", {}).get(node_id)
    if not node_data:
        raise RuntimeError(f"Node {node_id} not found in API response")
    root_node = node_data["document"]

    # Step 1: Read skinInfo
    print("Reading skinInfo...")
    skin_info_nodes = find_by_name(root_node, "skinInfo")
    if not skin_info_nodes:
        raise RuntimeError("skinInfo text node not found in root layers")

    skin_info_text = skin_info_nodes[0].get("characters", "")
    skin_info = json.loads(skin_info_text)
    skin_name = skin_info["name"]
    print(f"Skin name: {skin_name}")

    # Step 2: Create output folder
    skin_dir = os.path.join(output_dir, f"{skin_name} ({skin_type})")
    os.makedirs(skin_dir, exist_ok=True)

    # Step 3: Discover layers
    feature_layers, background_layers = discover_layers(root_node)
    print(f"Features found: {list(feature_layers.keys())}")
    print(f"Backgrounds found: {list(background_layers.keys())}")

    if not feature_layers:
        raise RuntimeError("No feature layers found in design")

    # Track exported assets
    exported = set()

    def export_fn(node, pdf_name):
        if pdf_name in exported:
            return
        dest = os.path.join(skin_dir, pdf_name)
        if os.path.exists(dest):
            print(f"    Skip (exists): {pdf_name}")
            exported.add(pdf_name)
            return
        print(f"    Export: {pdf_name}")
        export_node_pdf(file_key, node["id"], dest, token)
        exported.add(pdf_name)

    # Step 4: Build info.json
    info = build_info(skin_info, feature_layers, background_layers, export_fn, skin_type, root_node)

    # Step 5: Write info.json
    info_path = os.path.join(skin_dir, "info.json")
    with open(info_path, "w", encoding="utf-8") as f:
        json.dump(info, f, indent=4, ensure_ascii=False)

    # Step 6: Zip the skin directory
    suffix = ".manicskin" if skin_type == "manic" else ".deltaskin"
    skin_basename = f"{skin_name} ({skin_type})"
    zip_path = os.path.join(output_dir, skin_basename + suffix)

    print(f"  Creating {os.path.basename(zip_path)}...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(skin_dir):
            for fname in files:
                fpath = os.path.join(root, fname)
                arcname = os.path.relpath(fpath, skin_dir)
                zf.write(fpath, arcname)

    print(f"\nDelta Skin generated: {skin_dir}")
    print(f"  info.json written to: {info_path}")
    print(f"  Archive created: {zip_path}")
    return skin_dir


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        print("""
Options:
  --output-dir <dir>    Output directory (default: current directory)
  --token <token>       Figma personal access token (or set FIGMA_TOKEN env var)
  --skin-type <type>    Skin type: manic (default) or delta
""")
        sys.exit(0)

    figma_url = sys.argv[1]
    output_dir = os.getcwd()
    token = os.environ.get("FIGMA_TOKEN", "")
    skin_type = "manic"

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--output-dir" and i + 1 < len(sys.argv):
            output_dir = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--token" and i + 1 < len(sys.argv):
            token = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--skin-type" and i + 1 < len(sys.argv):
            skin_type = sys.argv[i + 1]
            i += 2
        else:
            print(f"Unknown argument: {sys.argv[i]}")
            sys.exit(1)

    if not token:
        print("Error: Figma token required. Set FIGMA_TOKEN env var or use --token.")
        sys.exit(1)

    if skin_type not in ("manic", "delta"):
        print(f"Error: --skin-type must be manic or delta")
        sys.exit(1)

    try:
        generate_skin(figma_url, output_dir, token, skin_type)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
