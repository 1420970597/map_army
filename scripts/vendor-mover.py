"""从本机 AFSIM 提取几何内核与模板；不复制 GUI、求解器或文档压缩包。"""

import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def extract(source, data):
    target = ROOT / "backend/mover/native"
    target.mkdir(parents=True, exist_ok=True)
    hashes = {}

    def read(name):
        raw = (source / name).read_bytes()
        hashes[name] = hashlib.sha256(raw).hexdigest()
        return raw.decode().replace("\r\n", "\n")

    cpp, header = read("GeometryObjFile.cpp"), read("GeometryObjFile.hpp")
    read("GeometryGLWidget.cpp")
    notice = cpp[:cpp.index("#include")]
    functions = cpp[cpp.index("void GeometryObjFile::DrawDish(double"):cpp.index("void GeometryObjFile::ObjPushMatrix()")]
    # 原 OBJ 分支遗漏平直进气道，使用 GUI 中相同的箱体开孔调用。
    functions = functions.replace("   UtVec3dX ptABL;\n}\n", "   UtVec3dX ptABL;\n   DrawBoxWithHole(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft);\n}\n")
    (target / "GeometryObjFile.cpp").write_text(notice + '#include "GeometryObjFile.hpp"\n#include "ObjPointCollection.hpp"\nnamespace Designer {\n' + functions + "\n}\n")
    declarations = header[header.index("         void DrawBodyCylinder"):header.index("         void OutputVertices")]
    (target / "GeometryObjFile.hpp").write_text(notice + '#pragma once\n#include "support.hpp"\nnamespace Designer {\nstruct GeometryBody {\n enum class ForwardShapeType {cCONE,cOGIVE,cROUND,cBLUNT};\n enum class AftShapeType {cCONE,cOGIVE,cROUND,cBOATTAIL,cBLUNT};\n};\nclass GeometryObjFile {\npublic:\n' + declarations + """
    void ObjBegin();
    void ObjVertex3d(double, double, double);
    void ObjNormal3d(double, double, double);
    void ObjEnd();
    void DrawSpeedBrake(double, double, double, double, double, double, double);
    nlohmann::json Mesh() const;
    inline static double mAirfoilPtsX[7] = {0, .05, .15, .25, .5, .75, 1};
    inline static double mAirfoilPtsY[7] = {0, .5, .875, 1, .875, .625, 0};
    inline static double mOgivePtsX[5] = {0, .4375, .6875, .875, 1};
    inline static double mOgivePtsY[5] = {1, .75, .5, .25, 0};
    glm::dmat4 matrix{1};
    std::vector<glm::dmat4> stack;
    std::vector<glm::dvec3> polygon;
    std::vector<double> positions;
};
}
""")
    for name in ["ObjPointCollection.cpp", "ObjPointCollection.hpp"]:
        content = read(name)
        content = re.sub(r'#include "(?:UtCast|UtVec3dX|Vehicle|UtMath)\.hpp"\n', '', content)
        (target / name).write_text(content)
    catalog = []
    destination = ROOT / "backend/mover/data"
    for folder, suffix, kind in [("Vehicles", ".amc", "vehicle"), ("Engines", ".amc", "engine"), ("Airfoils", ".foil", "airfoil")]:
        for path in sorted((data / folder).rglob("*" + suffix)):
            relative = path.relative_to(data).as_posix()
            raw = path.read_bytes()
            output = destination / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(raw)
            catalog.append({"id": path.stem, "kind": kind, "path": relative, "sha256": hashlib.sha256(raw).hexdigest()})
    (destination / "catalog.json").write_text(json.dumps(catalog, indent=2) + "\n")
    (target / "provenance.json").write_text(json.dumps({"source": str(source), "files": hashes, "adaptations": ["OpenGL-compatible matrix stack", "GUI speed brake and flat-sided nacelle", "meter mesh output"]}, indent=2) + "\n")
    print(f"Extracted {len(catalog)} templates and native geometry sources")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("/root/afsim/swdev/src/mover_creator/source"))
    parser.add_argument("--data", type=Path, default=Path("/root/afsim/afsim2.9-data/resources/data/mover_creator"))
    args = parser.parse_args()
    extract(args.source, args.data)
