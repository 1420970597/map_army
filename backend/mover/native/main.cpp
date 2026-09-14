#include <iostream>
#include "GeometryObjFile.hpp"
using namespace Designer;
using json = nlohmann::json;

void GeometryObjFile::ObjPushMatrix() { stack.push_back(matrix); }
void GeometryObjFile::ObjPopMatrix() {
    if (stack.empty()) throw std::runtime_error("matrix stack underflow");
    matrix = stack.back(); stack.pop_back();
}
void GeometryObjFile::ObjTranslated(double x, double y, double z) { matrix = glm::translate(matrix, glm::dvec3(x,y,z)); }
void GeometryObjFile::ObjRotated(double angle, double x, double y, double z) {
    matrix = glm::rotate(matrix, angle * UtMath::cRAD_PER_DEG, glm::dvec3(x,y,z));
}
void GeometryObjFile::ObjBegin() { polygon.clear(); }
void GeometryObjFile::ObjNormal3d(double, double, double) {}
void GeometryObjFile::ObjVertex3d(double x, double y, double z) {
    auto p = glm::dvec3(matrix * glm::dvec4(x,y,z,1)) * .3048;
    if (!std::isfinite(p.x) || !std::isfinite(p.y) || !std::isfinite(p.z)) throw std::runtime_error("non-finite geometry");
    polygon.push_back(p);
}
void GeometryObjFile::ObjEnd() {
    // 去掉尖端重合点形成的零面积三角形，按面重新计算法线。
    for (size_t i = 1; i + 1 < polygon.size(); ++i) {
        if (glm::length(glm::cross(polygon[i]-polygon[0],polygon[i+1]-polygon[0])) < 1e-12) continue;
        for (auto p: {polygon[0],polygon[i],polygon[i+1]}) positions.insert(positions.end(), {p.x,p.y,p.z});
    }
}
json GeometryObjFile::Mesh() const { return positions; }

void GeometryObjFile::DrawSpeedBrake(double x,double y,double z,double length,double width,double roll,double angle) {
    ObjPushMatrix(); ObjTranslated(x,-z,y); ObjRotated(roll,1,0,0); ObjRotated(angle,0,0,-1); ObjTranslated(-length*.5,0,0);
    double h = std::min(length,width)*.02;
    double l = length*.5, w = width*.5;
    const double p[8][3]={{-l,-h,-w},{l,-h,-w},{l,h,-w},{-l,h,-w},{-l,-h,w},{l,-h,w},{l,h,w},{-l,h,w}};
    const int f[6][4]={{0,3,2,1},{4,5,6,7},{0,1,5,4},{3,7,6,2},{0,4,7,3},{1,2,6,5}};
    for (auto& face:f) { ObjBegin(); for (int i:face) ObjVertex3d(p[i][0],p[i][1],p[i][2]); ObjEnd(); }
    ObjPopMatrix();
}

int main() {
    try {
        json input; std::cin >> input;
        json output = json::array();
        for (const auto& command : input) {
            GeometryObjFile g;
            const auto& a = command.at("args");
            const auto kind = command.at("kind").get<std::string>();
            if (kind == "body") g.DrawBody(a[0],a[1],a[2],a[3],a[4],a[5],GeometryBody::ForwardShapeType(a[6].get<int>()),a[7],GeometryBody::AftShapeType(a[8].get<int>()),a[9],a[10],a[11],a[12],a[13]);
            else if (kind == "surface") g.DrawSurface(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],a[9],20);
            else if (kind == "engine") g.DrawEngine(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8]);
            else if (kind == "dish") g.DrawDish(a[0],a[1],a[2],a[3],a[4]);
            else if (kind == "brake") g.DrawSpeedBrake(a[0],a[1],a[2],a[3],a[4],a[5],a[6]);
            else if (kind == "gear") {
                // 对照 GeometryGLWidget::DrawLandingGear 的支柱与轮胎定位。
                double x=a[0],y=a[1],z=a[2],length=a[3],strut=a[4],tire=a[5],width=a[6],angle=a[7];
                g.ObjPushMatrix();g.ObjTranslated(x,-z,y);g.ObjRotated(180-angle,0,0,-1);g.DrawCylinder(length-tire,strut);g.ObjPopMatrix();
                double rad=angle*UtMath::cRAD_PER_DEG;
                g.ObjPushMatrix();g.ObjTranslated(x-(length-tire*.5)*cos(rad),-z-(length-tire*.5)*sin(rad),y+width*.5);g.ObjRotated(90,0,1,0);g.DrawCylinder(width,tire);g.ObjPopMatrix();
            }
            else if (kind == "nacelle") g.DrawNacelle(a[0],a[1],a[2],a[3],a[4],a[5],a[6],a[7],a[8],a[9],a[10].get<std::string>(),a[11].get<std::string>(),a[12],a[13],a[14],a[15]);
            else throw std::runtime_error("unsupported geometry command");
            output.push_back({{"name",command.at("name")},{"positions",g.Mesh()}});
        }
        std::cout << output.dump();
    } catch (const std::exception& e) { std::cerr << e.what(); return 1; }
}
