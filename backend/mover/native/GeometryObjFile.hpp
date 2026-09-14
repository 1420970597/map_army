// ****************************************************************************
// CUI//REL TO USA ONLY
//
// The Advanced Framework for Simulation, Integration, and Modeling (AFSIM)
//
// Copyright 2017-2018 Infoscitex, a DCS Company. All rights reserved.
//
// The use, dissemination or disclosure of data in this file is subject to
// limitation or restriction. See accompanying README and LICENSE for details.
// ****************************************************************************

#pragma once
#include "support.hpp"
namespace Designer {
struct GeometryBody {
 enum class ForwardShapeType {cCONE,cOGIVE,cROUND,cBLUNT};
 enum class AftShapeType {cCONE,cOGIVE,cROUND,cBOATTAIL,cBLUNT};
};
class GeometryObjFile {
public:
         void DrawBodyCylinder(double aPosX,
                               double aPosY,
                               double aPosZ,
                               double aLength,
                               double aHeight,
                               double aWidth,
                               bool   aAft = false);

         void DrawBodyOgive(double aPosX,
                            double aPosY,
                            double aPosZ,
                            double aLength,
                            double aHeight,
                            double aWidth,
                            bool   aAft = false);

         void DrawBodyCone(double aPosX,
                           double aPosY,
                           double aPosZ,
                           double aLength,
                           double aHeight,
                           double aWidth,
                           bool   aAft = false);

         void DrawBodySphere(double aPosX,
                             double aPosY,
                             double aPosZ,
                             double aLength,
                             double aHeight,
                             double aWidth,
                             bool   aAft = false);

         void DrawBodyBoatTail(double aPosX,
                               double aPosY,
                               double aPosZ,
                               double aLength,
                               double aHeight,
                               double aWidth,
                               double aDiam,
                               bool   aAft = false);

         void DrawBodyBlunt(double aPosX,
                            double aPosY,
                            double aPosZ,
                            double aLength,
                            double aHeight,
                            double aWidth,
                            bool   aAft = false);

         void DrawRoundedNacelle(double             aLength_ft,
                                 double             aHeight_ft,
                                 double             aWidth_ft,
                                 double             aThickness_ft,
                                 const std::string& aOverallShapeString,
                                 bool               aAftSectionIsTapered,
                                 double             aAftSectionLength_ft);

         void DrawRoundedRightNacelle(double             aLength_ft,
                                      double             aHeight_ft,
                                      double             aWidth_ft,
                                      double             aThickness_ft,
                                      const std::string& aOverallShapeString,
                                      bool               aAftSectionIsTapered,
                                      double             aAftSectionLength_ft);

         void DrawRoundedLeftNacelle(double             aLength_ft,
                                     double             aHeight_ft,
                                     double             aWidth_ft,
                                     double             aThickness_ft,
                                     const std::string& aOverallShapeString,
                                     bool               aAftSectionIsTapered,
                                     double             aAftSectionLength_ft);

         void DrawRoundedTopNacelle(double             aLength_ft,
                                    double             aHeight_ft,
                                    double             aWidth_ft,
                                    double             aThickness_ft,
                                    const std::string& aOverallShapeString,
                                    bool               aAftSectionIsTapered,
                                    double             aAftSectionLength_ft);

         void DrawRoundedBottomNacelle(double             aLength_ft,
                                       double             aHeight_ft,
                                       double             aWidth_ft,
                                       double             aThickness_ft,
                                       const std::string& aOverallShapeString,
                                       bool               aAftSectionIsTapered,
                                       double             aAftSectionLength_ft);

         void DrawFlatSidedNacelle(double             aLength_ft,
                                   double             aHeight_ft,
                                   double             aWidth_ft,
                                   double             aThickness_ft,
                                   double             aForwardSweepLength_ft,
                                   const std::string& aOverallShapeString,
                                   bool               aAftSectionIsTapered,
                                   double             aAftSectionLength_ft);

         void DrawFlatSweptRightNacelle(double             aLength_ft,
                                        double             aHeightInner_ft,
                                        double             aHeightOuter_ft,
                                        double             aWidth_ft,
                                        double             aThickness_ft,
                                        double             aForwardSweepLength_ft,
                                        const std::string& aOverallShapeString,
                                        bool               aAftSectionIsTapered,
                                        double             aAftSectionLength_ft);

         void DrawFlatSweptLeftNacelle(double             aLength_ft,
                                       double             aHeightInner_ft,
                                       double             aHeightOuter_ft,
                                       double             aWidth_ft,
                                       double             aThickness_ft,
                                       double             aForwardSweepLength_ft,
                                       const std::string& aOverallShapeString,
                                       bool               aAftSectionIsTapered,
                                       double             aAftSectionLength_ft);

         void DrawBody(double                         aPosX,
                       double                         aPosY,
                       double                         aPosZ,
                       double                         aLength,
                       double                         aHeight,
                       double                         aWidth,
                       GeometryBody::ForwardShapeType aFrontShapeString,
                       double                         aFrontLength,
                       GeometryBody::AftShapeType     aAftShapeString,
                       double                         aRearLength,
                       double                         aBoatTailDiam,
                       double                         aYaw_deg,
                       double                         aPitch_deg,
                       double                         aRoll_deg);

         void DrawEngine(double aPosX,
                         double aPosY,
                         double aPosZ,
                         double aDiameter_ft,
                         double aLength_ft,
                         double aOffset_ft,
                         double aYaw_deg,
                         double aPitch_deg,
                         double aRoll_deg);

         void DrawSurface(double aPosX,
                          double aPosY,
                          double aPosZ,
                          double aSpan,
                          double aSweep_deg,
                          double aRootChord,
                          double aTipChord,
                          double aThicknessRatio,
                          double aDihedral_deg,
                          double aIncidence_deg,
                          int    aNumSpanElements);

         void DrawNacelle(double             aPosX,
                          double             aPosY,
                          double             aPosZ,
                          double             aLength_ft,
                          double             aHeight_ft,
                          double             aHeightInner_ft,
                          double             aHeightOuter_ft,
                          double             aWidth_ft,
                          double             aThickness_ft,
                          double             aForwardSweepLength_ft,
                          const std::string& aOverallShapeString,
                          const std::string& aAftSectionString,
                          double             aAftSectionLength_ft,
                          double             aYaw_deg,
                          double             aPitch_deg,
                          double             aRoll_deg);

         void DrawDish(double aPosX,
                       double aPosY,
                       double aPosZ,
                       double aDiameter_ft,
                       double aThickness_ft);

         void DrawBoxWithHole(double aLength, double aHeight, double aWidth, double aThickness);

         void DrawCylinder(double aLength, double aDiameter);

         double EllipticalY_GivenX(double x, double aHalfWidth, double aHalfHeight);
         double EllipticalX_GivenY(double y, double aHalfWidth, double aHalfHeight);

         void ObjPushMatrix();
         void ObjTranslated(double aPosX, double aPosY, double aPosZ);
         void ObjRotated(double aAngle_deg, double aX, double aY, double aZ);
         void ObjPopMatrix();


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
