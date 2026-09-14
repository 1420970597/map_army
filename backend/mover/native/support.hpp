#pragma once
#include <cmath>
#include <cstddef>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <nlohmann/json.hpp>

namespace ut { constexpr size_t npos = size_t(-1); }
namespace UtMath { constexpr double cRAD_PER_DEG = 0.017453292519943295; }

// 保留原生函数的向量接口，矩阵计算交给 GLM。
class UtVec3dX {
public:
    glm::dvec3 v{0};
    UtVec3dX() = default;
    UtVec3dX(double x, double y, double z): v(x,y,z) {}
    explicit UtVec3dX(glm::dvec3 value): v(value) {}
    double X() const { return v.x; }
    double Y() const { return v.y; }
    double Z() const { return v.z; }
    void Set(double x, double y, double z) { v = {x,y,z}; }
    void Normalize() { double n = glm::length(v); if (n > 1e-14) v /= n; }
    UtVec3dX Cross(const UtVec3dX& b) const { return UtVec3dX(glm::cross(v,b.v)); }
    UtVec3dX operator+(const UtVec3dX& b) const { return UtVec3dX(v+b.v); }
    UtVec3dX operator-(const UtVec3dX& b) const { return UtVec3dX(v-b.v); }
};

class UtDCM {
    glm::dmat4 m{1};
public:
    UtDCM(double yaw, double pitch, double roll) {
        m = glm::rotate(m, yaw, glm::dvec3(0,0,1));
        m = glm::rotate(m, pitch, glm::dvec3(0,1,0));
        m = glm::rotate(m, roll, glm::dvec3(1,0,0));
    }
    UtVec3dX InverseTransform(const UtVec3dX& v) const { return UtVec3dX(glm::dvec3(m * glm::dvec4(v.v,0))); }
};
