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

#include "GeometryObjFile.hpp"
#include "ObjPointCollection.hpp"
namespace Designer {
void GeometryObjFile::DrawDish(double aPosX,
                               double aPosY,
                               double aPosZ,
                               double aDiameter_ft,
                               double aThickness_ft)
{
   // Check data
   if ((aDiameter_ft <= 0.0) || (aThickness_ft <= 0.0)) { return; }

   // Data points
   double r[19];
   double h[19];
   double normal_r[19];
   double normal_h[19];

   double radius = 0.5 * aDiameter_ft;
   double halfThickness = 0.5 * aThickness_ft;

   h[0] = -halfThickness;
   r[0] = 0.0;
   h[18] = halfThickness;
   r[18] = 0.0;

   normal_r[0] = 0;
   normal_h[0] = -1.0;
   normal_r[18] = 0.0;
   normal_h[18] = 1.0;

   int count = 1;
   for (int iang_deg = -80; iang_deg <= 80; iang_deg += 10)
   {
      double ang_r = (double)iang_deg * UtMath::cRAD_PER_DEG;
      r[count] = radius * cos(ang_r);
      h[count] = halfThickness * sin(ang_r);
      ++count;
   }

   for (int i = 1; i < 18; ++i)
   {
      UtVec3dX lastPt(r[i - 1], h[i - 1], 0.0);
      UtVec3dX currentPt(r[i], h[i], 0.0);
      UtVec3dX nextPt(r[i + 1], h[i + 1], 0.0);
      UtVec3dX lastVec = lastPt - currentPt;
      UtVec3dX nextVec = nextPt - currentPt;
      UtVec3dX posZVec(0.0, 0.0, 1.0);
      UtVec3dX negZVec(0.0, 0.0, -1.0);

      UtVec3dX lastNormVec = lastVec.Cross(negZVec);
      UtVec3dX nextNormVec = nextVec.Cross(posZVec);
      UtVec3dX normVec = lastNormVec + nextNormVec;
      normVec.Normalize();
      normal_r[i] = normVec.X();
      normal_h[i] = normVec.Y();
   }

   ObjPushMatrix();
   ObjTranslated(aPosX, -aPosZ, aPosY);

   int delta_iang = 10;
   for (int iang = delta_iang; iang <= 360; iang += delta_iang)
   {
      double ang0_rad = (double)(iang - delta_iang) * UtMath::cRAD_PER_DEG;
      double ang1_rad = (double)iang * UtMath::cRAD_PER_DEG;


      {
         double pt0x = r[0];
         double pt0y = h[0];
         double pt0z = r[0];

         double norm0x = normal_r[0];
         double norm0y = normal_h[0];
         double norm0z = normal_r[0];

         double pt1x = r[1] * sin(ang0_rad);
         double pt1y = h[1];
         double pt1z = r[1] * cos(ang0_rad);

         double norm1x = normal_r[1] * sin(ang0_rad);
         double norm1y = normal_h[1];
         double norm1z = normal_r[1] * cos(ang0_rad);

         double pt2x = r[1] * sin(ang1_rad);
         double pt2y = h[1];
         double pt2z = r[1] * cos(ang1_rad);

         double norm2x = normal_r[1] * sin(ang1_rad);
         double norm2y = normal_h[1];
         double norm2z = normal_r[1] * cos(ang1_rad);

         ObjBegin();
         ObjNormal3d(norm2x, norm2y, norm2z);
         ObjVertex3d(pt2x, pt2y, pt2z);
         ObjNormal3d(norm1x, norm1y, norm1z);
         ObjVertex3d(pt1x, pt1y, pt1z);
         ObjNormal3d(norm0x, norm0y, norm0z);
         ObjVertex3d(pt0x, pt0y, pt0z);
         ObjEnd();
      }

      for (int j = 1; j < 17; ++j)
      {
         double pt0x = r[j] * sin(ang0_rad);
         double pt0y = h[j];
         double pt0z = r[j] * cos(ang0_rad);

         double norm0x = normal_r[j] * sin(ang0_rad);
         double norm0y = normal_h[j];
         double norm0z = normal_r[j] * cos(ang0_rad);

         double pt1x = r[j + 1] * sin(ang0_rad);
         double pt1y = h[j + 1];
         double pt1z = r[j + 1] * cos(ang0_rad);

         double norm1x = normal_r[j + 1] * sin(ang0_rad);
         double norm1y = normal_h[j + 1];
         double norm1z = normal_r[j + 1] * cos(ang0_rad);

         double pt2x = r[j + 1] * sin(ang1_rad);
         double pt2y = h[j + 1];
         double pt2z = r[j + 1] * cos(ang1_rad);

         double norm2x = normal_r[j + 1] * sin(ang1_rad);
         double norm2y = normal_h[j + 1];
         double norm2z = normal_r[j + 1] * cos(ang1_rad);

         double pt3x = r[j] * sin(ang1_rad);
         double pt3y = h[j];
         double pt3z = r[j] * cos(ang1_rad);

         double norm3x = normal_r[j] * sin(ang1_rad);
         double norm3y = normal_h[j];
         double norm3z = normal_r[j] * cos(ang1_rad);

         ObjBegin();
         ObjNormal3d(norm3x, norm3y, norm3z);
         ObjVertex3d(pt3x, pt3y, pt3z);
         ObjNormal3d(norm2x, norm2y, norm2z);
         ObjVertex3d(pt2x, pt2y, pt2z);
         ObjNormal3d(norm1x, norm1y, norm1z);
         ObjVertex3d(pt1x, pt1y, pt1z);
         ObjNormal3d(norm0x, norm0y, norm0z);
         ObjVertex3d(pt0x, pt0y, pt0z);
         ObjEnd();
      }

      {
         double pt0x = r[18];
         double pt0y = h[18];
         double pt0z = r[18];

         double norm0x = normal_r[18];
         double norm0y = normal_h[18];
         double norm0z = normal_r[18];

         double pt1x = r[17] * sin(ang0_rad);
         double pt1y = h[17];
         double pt1z = r[17] * cos(ang0_rad);

         double norm1x = normal_r[17] * sin(ang0_rad);
         double norm1y = normal_h[17];
         double norm1z = normal_r[17] * cos(ang0_rad);

         double pt2x = r[17] * sin(ang1_rad);
         double pt2y = h[17];
         double pt2z = r[17] * cos(ang1_rad);

         double norm2x = normal_r[17] * sin(ang1_rad);
         double norm2y = normal_h[17];
         double norm2z = normal_r[17] * cos(ang1_rad);

         ObjBegin();
         ObjNormal3d(norm0x, norm0y, norm0z);
         ObjVertex3d(pt0x, pt0y, pt0z);
         ObjNormal3d(norm1x, norm1y, norm1z);
         ObjVertex3d(pt1x, pt1y, pt1z);
         ObjNormal3d(norm2x, norm2y, norm2z);
         ObjVertex3d(pt2x, pt2y, pt2z);
         ObjEnd();
      }
   }

   ObjPopMatrix();
}

void GeometryObjFile::DrawBodyCylinder(double aPosX,
                                       double aPosY,
                                       double aPosZ,
                                       double aLength,
                                       double aHeight,
                                       double aWidth,
                                       bool   aAft)
{
   ObjPointCollection pointCollection(true, *this);

   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   // Add main/base ring
   pointCollection.AddRing();

   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }

   // Add far end ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals
   pointCollection.CalculatePointCollection();

   // Draw
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
      pointCollection.Draw();
      ObjPopMatrix();
   }
   else
   {
      pointCollection.Draw();
   }
}

void GeometryObjFile::DrawBodyOgive(double aPosX,
                                    double aPosY,
                                    double aPosZ,
                                    double aLength,
                                    double aHeight,
                                    double aWidth,
                                    bool   aAft)
{
   ObjPointCollection pointCollection(true, *this);

   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;
   double lengthFactor = 0.0;
   double radiusFactor = 1.0;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   // Add main/base ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add second ring
   lengthFactor = 0.3;
   radiusFactor = 0.9;
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add third ring
   lengthFactor = 0.55;
   radiusFactor = 0.7;
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add fourth ring
   lengthFactor = 0.8;
   radiusFactor = 0.4;
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add fifth (last) ring
   lengthFactor = 1.0;
   radiusFactor = 0.001;
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals
   pointCollection.CalculatePointCollection();

   // Draw
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
      pointCollection.Draw();
      ObjPopMatrix();
   }
   else
   {
      pointCollection.Draw();
   }
}

void GeometryObjFile::DrawBodyCone(double aPosX,
                                   double aPosY,
                                   double aPosZ,
                                   double aLength,
                                   double aHeight,
                                   double aWidth,
                                   bool   aAft)
{
   ObjPointCollection pointCollection(true, *this);

   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   // Add main/base ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }

   // Add nose/tip ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = -aPosZ;
      double z = aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = -aPosZ;
      double z = aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = -aPosZ;
      double z = aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = -aPosZ;
      double z = aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals
   pointCollection.CalculatePointCollection();

   // Draw
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
      pointCollection.Draw();
      ObjPopMatrix();
   }
   else
   {
      pointCollection.Draw();
   }
}

void GeometryObjFile::DrawBodySphere(double aPosX,
                                     double aPosY,
                                     double aPosZ,
                                     double aLength,
                                     double aHeight,
                                     double aWidth,
                                     bool   aAft)
{
   ObjPointCollection pointCollection(true, *this);

   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;
   double lengthFactor = 0.0;
   double radiusFactor = 1.0;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   // Add main/base ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add second ring
   lengthFactor = 0.2;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add third ring
   lengthFactor = 0.4;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add fourth ring
   lengthFactor = 0.6;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add fifth ring
   lengthFactor = 0.8;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add sixth ring
   lengthFactor = 0.9;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Add seventh (and last) ring
   lengthFactor = 0.999;
   radiusFactor = sqrt(1.0 - lengthFactor * lengthFactor);
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = -EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight * radiusFactor;
      double z = EllipticalX_GivenY(y, halfWidth * radiusFactor, halfHeight * radiusFactor);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength * lengthFactor;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals
   pointCollection.CalculatePointCollection();

   // Draw
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
      pointCollection.Draw();
      ObjPopMatrix();
   }
   else
   {
      pointCollection.Draw();
   }
}

void GeometryObjFile::DrawBodyBoatTail(double aPosX,
                                       double aPosY,
                                       double aPosZ,
                                       double aLength,
                                       double aHeight,
                                       double aWidth,
                                       double aDiam,
                                       bool   aAft)
{
   ObjPointCollection pointCollection(true, *this);

   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;
   double radius = 0.5 * aDiam;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   // Add main/base ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX;
      pointCollection.AddPoint(x, y, z);
   }

   // Add boat tail ring
   pointCollection.AddRing();
   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = -EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = -EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals
   pointCollection.CalculatePointCollection();

   // Draw
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
      pointCollection.Draw();
   }
   else
   {
      pointCollection.Draw();
   }

   // Now, handle the end disk

   std::vector<UtVec3dX> vertices;

   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = -EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = -EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * radius;
      double z = EllipticalX_GivenY(y, radius, radius);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }

   // Draw disk

   ObjBegin();
   // Need to run through points in reverse to get proper winding order
   for (auto revIter = vertices.rbegin(); revIter != vertices.rend(); ++revIter)
   {
      ObjNormal3d(1.0, 0.0, 0.0);
      UtVec3dX& vec = *revIter;
      ObjVertex3d(vec.X(), vec.Y(), vec.Z());
   }
   ObjEnd();

   if (aAft)
   {
      ObjPopMatrix();
   }
}

void GeometryObjFile::DrawBodyBlunt(double aPosX,
                                    double aPosY,
                                    double aPosZ,
                                    double aLength,
                                    double aHeight,
                                    double aWidth,
                                    bool   aAft)
{
   double halfHeight = 0.5 * aHeight;
   double halfWidth = 0.5 * aWidth;

   int numSteps = 10;

   double stepFactor = 1.0 / static_cast<double>(numSteps);

   std::vector<UtVec3dX> vertices;

   for (int hgt = 0; hgt < numSteps; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = numSteps; hgt > 0; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = 0; hgt > -numSteps; --hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = -EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }
   for (int hgt = -numSteps; hgt < 0; ++hgt)
   {
      double y = stepFactor * (double)hgt * halfHeight;
      double z = EllipticalX_GivenY(y, halfWidth, halfHeight);
      y += -aPosZ;
      z += aPosY;
      double x = aPosX + aLength;
      UtVec3dX vert(x, y, z);
      vertices.push_back(vert);
   }

   // Draw disk
   if (aAft)
   {
      ObjPushMatrix();
      ObjRotated(180.0, 0.0, -1.0, 0.0);
   }

   ObjBegin();

   // Need to run through points in reverse to get proper winding order
   for (std::vector<UtVec3dX>::reverse_iterator revIter = vertices.rbegin();
        revIter != vertices.rend(); ++revIter)
   {
      ObjNormal3d(1.0, 0.0, 0.0);
      UtVec3dX& vec = *revIter;
      ObjVertex3d(vec.X(), vec.Y(), vec.Z());
   }

   ObjEnd();

   if (aAft)
   {
      ObjPopMatrix();
   }
}

void GeometryObjFile::DrawBody(double                         aPosX,
                               double                         aPosY,
                               double                         aPosZ,
                               double                         aLength,
                               double                         aHeight,
                               double                         aWidth,
                               GeometryBody::ForwardShapeType aFrontShape,
                               double                         aFrontLength,
                               GeometryBody::AftShapeType     aAftShape,
                               double                         aRearLength,
                               double                         aBoatTailDiam,
                               double                         aYaw_deg,
                               double                         aPitch_deg,
                               double                         aRoll_deg)
{
   // Verify correct values
   if ((aFrontLength + aRearLength) >= aLength) { return; }

   ObjPushMatrix();
   ObjTranslated(aPosX, -aPosZ, aPosY);
   ObjRotated(aYaw_deg, 0.0, -1.0, 0.0);
   ObjRotated(aPitch_deg, 0.0, 0.0, 1.0);
   ObjRotated(aRoll_deg, 1.0, 0.0, 0.0);

   // Draw forward shape

   switch (aFrontShape)
   {
      case Designer::GeometryBody::ForwardShapeType::cCONE:
         DrawBodyCone((aLength * 0.5 - aFrontLength), 0.0, 0.0, aFrontLength, aHeight, aWidth);
         break;
      case Designer::GeometryBody::ForwardShapeType::cOGIVE:
         DrawBodyOgive((aLength * 0.5 - aFrontLength), 0.0, 0.0, aFrontLength, aHeight, aWidth);
         break;
      case Designer::GeometryBody::ForwardShapeType::cROUND:
         DrawBodySphere((aLength * 0.5 - aFrontLength), 0.0, 0.0, aFrontLength, aHeight, aWidth);
         break;
      case Designer::GeometryBody::ForwardShapeType::cBLUNT:
         aFrontLength = 0.0; // Ensure front length is zero if blunt
         DrawBodyBlunt((aLength * 0.5 - aFrontLength), 0.0, 0.0, aFrontLength, aHeight, aWidth);
         break;
      default:
         break;
   }

   // Draw main/center shape (cylinder)
   DrawBodyCylinder((-aLength * 0.5 + aRearLength), 0.0, 0.0, aLength - aFrontLength - aRearLength, aHeight, aWidth);

   switch (aAftShape)
   {
      case Designer::GeometryBody::AftShapeType::cCONE:
         DrawBodyCone((aLength * 0.5 - aRearLength), 0.0, 0.0, aRearLength, aHeight, aWidth, true);
         break;
      case Designer::GeometryBody::AftShapeType::cOGIVE:
         DrawBodyOgive((aLength * 0.5 - aRearLength), 0.0, 0.0, aRearLength, aHeight, aWidth, true);
         break;
      case Designer::GeometryBody::AftShapeType::cROUND:
         DrawBodySphere((aLength * 0.5 - aRearLength), 0.0, 0.0, aRearLength, aHeight, aWidth, true);
         break;
      case Designer::GeometryBody::AftShapeType::cBOATTAIL:
         DrawBodyBoatTail((aLength * 0.5 - aRearLength), 0.0, 0.0, aRearLength, aHeight, aWidth, aBoatTailDiam, true);
         break;
      case Designer::GeometryBody::AftShapeType::cBLUNT:
         aRearLength = 0.0; // Ensure aft length is zero if blunt
         DrawBodyBlunt((aLength * 0.5 - aRearLength), 0.0, 0.0, aRearLength, aHeight, aWidth, true);
         break;
      default:
         break;
   }

   ObjPopMatrix();
}

void GeometryObjFile::DrawBoxWithHole(double aLength, double aHeight, double aWidth, double aThickness)
{
   double xFront  = aLength *  0.5;
   double xBack   = aLength * -0.5;
   double yTop    = aHeight *  0.5;
   double yBottom = aHeight * -0.5;
   double zRight  = aWidth  *  0.5;
   double zLeft   = aWidth  * -0.5;

   // Outside Right
   ObjBegin();
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xBack, yBottom, zRight);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xFront, yBottom, zRight);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xFront, yTop, zRight);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xBack, yTop, zRight);
   ObjEnd();

   // Outside Left
   ObjBegin();
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xFront, yBottom, zLeft);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xBack, yBottom, zLeft);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xBack, yTop, zLeft);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xFront, yTop, zLeft);
   ObjEnd();

   // Outside Top
   ObjBegin();
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xFront, yTop, zLeft);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xBack, yTop, zLeft);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xBack, yTop, zRight);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xFront, yTop, zRight);
   ObjEnd();

   // Outside Bottom
   ObjBegin();
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xFront, yBottom, zLeft);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xFront, yBottom, zRight);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xBack, yBottom, zRight);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xBack, yBottom, zLeft);
   ObjEnd();

   // Inside Right
   ObjBegin();
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xBack, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xFront, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xFront, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(xBack, yBottom + aThickness, zRight - aThickness);
   ObjEnd();

   // Inside Left
   ObjBegin();
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xFront, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xBack, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xBack, yBottom + aThickness, zLeft + aThickness);
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(xFront, yBottom + aThickness, zLeft + aThickness);
   ObjEnd();

   // Inside Top
   ObjBegin();
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(0.0, -1.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zLeft + aThickness);
   ObjEnd();

   // Inside Bottom
   ObjBegin();
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zLeft + aThickness);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(0.0, 1.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zLeft + aThickness);
   ObjEnd();

   // Front
   ObjBegin();
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom, zRight);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom, zLeft);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zLeft + aThickness);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zRight - aThickness);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom, zLeft);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop, zLeft);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zLeft + aThickness);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop, zRight);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom, zRight);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zRight - aThickness);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop, zLeft);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop, zRight);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(1.0, 0.0, 0.0);
   ObjVertex3d(xFront, yTop - aThickness, zLeft + aThickness);
   ObjEnd();

   // Back
   ObjBegin();
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zLeft + aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom, zLeft);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom, zRight);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zLeft + aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop, zLeft);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom, zLeft);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom + aThickness, zRight - aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yBottom, zRight);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop, zRight);
   ObjEnd();

   ObjBegin();
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zLeft + aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop - aThickness, zRight - aThickness);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop, zRight);
   ObjNormal3d(-1.0, 0.0, 0.0);
   ObjVertex3d(xBack, yTop, zLeft);
   ObjEnd();
}

void GeometryObjFile::DrawCylinder(double aLength, double aDiameter)
{
   double r = aDiameter * 0.5;

   double ang_rad[20];
   for (int i = 0; i < 20; ++i)
   {
      ang_rad[i] = (double)i * 18.0 * UtMath::cRAD_PER_DEG;
   }
   UtVec3dX ptVec[20];
   for (int i = 0; i < 20; ++i)
   {
      double x = 0.0;
      double y = r * sin(ang_rad[i]);
      double z = r * cos(ang_rad[i]);
      ptVec[i].Set(x, y, z);
   }

   UtVec3dX normVec[20];
   for (int i = 0; i < 20; ++i)
   {
      double x = 0.0;
      double y = sin(ang_rad[i]);
      double z = cos(ang_rad[i]);
      normVec[i].Set(x, y, z);
      normVec[i].Normalize();
   }

   for (int i = 0; i < 20; ++i)
   {
      ObjBegin();

      int pt1 = i;
      int pt2 = i + 1;
      if (pt2 > 19) { pt2 = 0; }

      ObjNormal3d(normVec[pt2].X(), normVec[pt2].Y(), normVec[pt2].Z());
      ObjVertex3d(0.0, ptVec[pt2].Y(), ptVec[pt2].Z());
      ObjNormal3d(normVec[pt1].X(), normVec[pt1].Y(), normVec[pt1].Z());
      ObjVertex3d(0.0, ptVec[pt1].Y(), ptVec[pt1].Z());
      ObjNormal3d(normVec[pt1].X(), normVec[pt1].Y(), normVec[pt1].Z());
      ObjVertex3d(aLength, ptVec[pt1].Y(), ptVec[pt1].Z());
      ObjNormal3d(normVec[pt2].X(), normVec[pt2].Y(), normVec[pt2].Z());
      ObjVertex3d(aLength, ptVec[pt2].Y(), ptVec[pt2].Z());

      ObjEnd();
   }

   ObjBegin();
   for (int i = 0; i < 20; ++i)
   {
      ObjNormal3d(-1.0, 0.0, 0.0);
      ObjVertex3d(0.0, ptVec[i].Y(), ptVec[i].Z());
   }
   ObjEnd();

   ObjBegin();
   for (int i = 19; i >= 0; --i)
   {
      ObjNormal3d(1.0, 0.0, 0.0);
      ObjVertex3d(aLength, ptVec[i].Y(), ptVec[i].Z());
   }
   ObjEnd();
}

void GeometryObjFile::DrawEngine(double aPosX,
                                 double aPosY,
                                 double aPosZ,
                                 double aDiameter_ft,
                                 double aLength_ft,
                                 double aOffset_ft,
                                 double aYaw_deg,
                                 double aPitch_deg,
                                 double aRoll_deg)
{
   UtVec3dX zeroPt(0.0, 0.0, 0.0);

   UtDCM dcm(aYaw_deg * UtMath::cRAD_PER_DEG, aPitch_deg * UtMath::cRAD_PER_DEG, aRoll_deg * UtMath::cRAD_PER_DEG);
   UtVec3dX pushBack(-aLength_ft * 0.5, 0.0, 0.0);
   pushBack = dcm.InverseTransform(pushBack);
   UtVec3dX refPt(aPosX, aPosY, aPosZ);
   UtVec3dX adjustedRefPt = refPt + pushBack;

   ObjPushMatrix();
   ObjTranslated(adjustedRefPt.X(), -adjustedRefPt.Z(), adjustedRefPt.Y());
   ObjRotated(aYaw_deg, 0.0, -1.0, 0.0);
   ObjRotated(aPitch_deg, 0.0, 0.0, 1.0);
   ObjRotated(aRoll_deg, 1.0, 0.0, 0.0);
   DrawCylinder(aLength_ft, aDiameter_ft);
   ObjPopMatrix();

   if ((aLength_ft * 0.5 + aOffset_ft) < 0.0)
   {
      double burnerLength = -aLength_ft * 0.5 - aOffset_ft;

      pushBack.Set(-aLength_ft * 0.5 - burnerLength, 0.0, 0.0);
      pushBack = dcm.InverseTransform(pushBack);
      refPt.Set(aPosX, aPosY, aPosZ);
      adjustedRefPt = refPt + pushBack;

      ObjPushMatrix();
      ObjTranslated(adjustedRefPt.X(), -adjustedRefPt.Z(), adjustedRefPt.Y());
      ObjRotated(aYaw_deg, 0.0, -1.0, 0.0);
      ObjRotated(aPitch_deg, 0.0, 0.0, 1.0);
      ObjRotated(aRoll_deg, 1.0, 0.0, 0.0);
      DrawCylinder(burnerLength, aDiameter_ft);
      ObjPopMatrix();
   }
}

void GeometryObjFile::DrawSurface(double aPosX,
                                  double aPosY,
                                  double aPosZ,
                                  double aSpan,
                                  double aSweep_deg,
                                  double aRootChord,
                                  double aTipChord,
                                  double aThicknessRatio,
                                  double aDihedral_deg,
                                  double aIncidence_deg,
                                  int    aNumSpanElements)
{
   ObjPushMatrix();

   ObjTranslated(aPosX, -aPosZ, aPosY);
   ObjRotated(aDihedral_deg, -1.0, 0.0, 0.0);
   ObjRotated(aIncidence_deg, 0.0, 0.0, 1.0);

   // Root Airfoil loop
   double rootLeadingEdgeX = aRootChord * 0.25;  // LE is 25% root chord forward of ref pt

   // Tip Airfoil loop
   double tipLeadingEdgeX = rootLeadingEdgeX - aSpan * tan(aSweep_deg * UtMath::cRAD_PER_DEG);

   // Root top surface
   ObjBegin();
   for (int i = 6; i >= 0; --i)
   {
      ObjNormal3d(0.0, 0.0, -1.0);
      ObjVertex3d(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
   }
   ObjEnd();

   // Root bottom surface
   ObjBegin();
   for (int i = 0; i < 7; ++i)
   {
      ObjNormal3d(0.0, 0.0, -1.0);
      // Negative height
      ObjVertex3d(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
   }
   ObjEnd();

   // Tip top surface
   ObjBegin();
   for (int i = 0; i < 7; ++i)
   {
      ObjNormal3d(0.0, 0.0, 1.0);
      ObjVertex3d(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
   }
   ObjEnd();

   // Tip bottom surface
   ObjBegin();
   for (int i = 6; i >= 0; --i)
   {
      ObjNormal3d(0.0, 0.0, 1.0);
      // Negative height
      ObjVertex3d(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
   }
   ObjEnd();

   // Next, we calculate the normals for the root/tip top surfaces. Keep in mind that lower values are near the LE.
   UtVec3dX TopRootNormals[7];
   UtVec3dX TopTipNormals[7];
   UtVec3dX spanVec(0.0, 0.0, 0.0);
   UtVec3dX chordVec(0.0, 0.0, 0.0);
   for (int i = 0; i < 7; ++i)
   {
      if (i == 0)
      {
         // Special case - no fore
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
         UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootAft - rootCenter;
         TopRootNormals[i] = chordVec.Cross(spanVec);
         TopRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipAft - tipCenter;
         TopTipNormals[i] = spanVec.Cross(chordVec);
         TopTipNormals[i].Normalize();
      }
      else if (i == 6)
      {
         // Special case - no aft
         UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i - 1], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i - 1], aSpan);
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i - 1], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i - 1], 0.0);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootFore - rootCenter;
         TopRootNormals[i] = spanVec.Cross(chordVec);
         TopRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipFore - tipCenter;
         TopTipNormals[i] = chordVec.Cross(spanVec);
         TopTipNormals[i].Normalize();
      }
      else
      {
         // Nominal case
         UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i - 1], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i - 1], aSpan);
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);
         UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i - 1], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i - 1], 0.0);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
         UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootAft - rootCenter;
         UtVec3dX rootAftTempNormal = chordVec.Cross(spanVec);
         chordVec = rootFore - rootCenter;
         UtVec3dX rootForeTempNormal = spanVec.Cross(chordVec);
         TopRootNormals[i] = rootAftTempNormal + rootForeTempNormal;
         TopRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipAft - tipCenter;
         UtVec3dX tipAftTempNormal = spanVec.Cross(chordVec);
         chordVec = tipFore - tipCenter;
         UtVec3dX tipForeTempNormal = chordVec.Cross(spanVec);
         TopTipNormals[i] = tipAftTempNormal + tipForeTempNormal;
         TopTipNormals[i].Normalize();
      }
   }

   // Next, we calculate the normals for the root/tip bottom surfaces. Keep in mind that lower values are near the LE.
   UtVec3dX BottomRootNormals[7];
   UtVec3dX BottomTipNormals[7];
   for (int i = 0; i < 7; ++i)
   {
      if (i == 0)
      {
         // Special case - no fore (be sure to negate the Y term, since we're doing the bottom)
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
         UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootAft - rootCenter;
         BottomRootNormals[i] = spanVec.Cross(chordVec);
         BottomRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipAft - tipCenter;
         BottomTipNormals[i] = chordVec.Cross(spanVec);
         BottomTipNormals[i].Normalize();
      }
      else if (i == 6)
      {
         // Special case - no aft (be sure to negate the Y term, since we're doing the bottom)
         UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i - 1], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i - 1], aSpan);
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i - 1], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i - 1], 0.0);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootFore - rootCenter;
         BottomRootNormals[i] = chordVec.Cross(spanVec);
         BottomRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipFore - tipCenter;
         BottomTipNormals[i] = spanVec.Cross(chordVec);
         BottomTipNormals[i].Normalize();
      }
      else
      {
         // Nominal case (be sure to negate the Y term, since we're doing the bottom)
         UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i - 1], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i - 1], aSpan);
         UtVec3dX tipCenter(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
         UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);
         UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i - 1], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i - 1], 0.0);
         UtVec3dX rootCenter(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
         UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);

         spanVec = tipCenter - rootCenter;
         chordVec = rootAft - rootCenter;
         UtVec3dX rootAftTempNormal = spanVec.Cross(chordVec);
         chordVec = rootFore - rootCenter;
         UtVec3dX rootForeTempNormal = chordVec.Cross(spanVec);
         BottomRootNormals[i] = rootAftTempNormal + rootForeTempNormal;
         BottomRootNormals[i].Normalize();

         spanVec = rootCenter - tipCenter;
         chordVec = tipAft - tipCenter;
         UtVec3dX tipAftTempNormal = chordVec.Cross(spanVec);
         chordVec = tipFore - tipCenter;
         UtVec3dX tipForeTempNormal = spanVec.Cross(chordVec);
         BottomTipNormals[i] = tipAftTempNormal + tipForeTempNormal;
         BottomTipNormals[i].Normalize();
      }
   }

   // Top surface
   for (int i = 0; i < 6; ++i)
   {
      UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
      UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
      UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);
      UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], 0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);

      ObjBegin();
      ObjNormal3d(TopTipNormals[i].X(), TopTipNormals[i].Y(), TopTipNormals[i].Z());
      ObjVertex3d(tipFore.X(), tipFore.Y(), tipFore.Z());

      ObjNormal3d(TopRootNormals[i].X(), TopRootNormals[i].Y(), TopRootNormals[i].Z());
      ObjVertex3d(rootFore.X(), rootFore.Y(), rootFore.Z());

      ObjNormal3d(TopRootNormals[i + 1].X(), TopRootNormals[i + 1].Y(), TopRootNormals[i + 1].Z());
      ObjVertex3d(rootAft.X(), rootAft.Y(), rootAft.Z());

      ObjNormal3d(TopTipNormals[i + 1].X(), TopTipNormals[i + 1].Y(), TopTipNormals[i + 1].Z());
      ObjVertex3d(tipAft.X(), tipAft.Y(), tipAft.Z());
      ObjEnd();
   }

   // Bottom surface
   for (int i = 0; i < 6; ++i)
   {
      UtVec3dX tipFore(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i], aSpan);
      UtVec3dX rootFore(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i], 0.0);
      UtVec3dX rootAft(rootLeadingEdgeX - aRootChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aRootChord * mAirfoilPtsY[i + 1], 0.0);
      UtVec3dX tipAft(tipLeadingEdgeX - aTipChord * mAirfoilPtsX[i + 1], -0.5 * aThicknessRatio * aTipChord * mAirfoilPtsY[i + 1], aSpan);

      ObjBegin();
      ObjNormal3d(BottomRootNormals[i].X(), BottomRootNormals[i].Y(), BottomRootNormals[i].Z());
      ObjVertex3d(rootFore.X(), rootFore.Y(), rootFore.Z());

      ObjNormal3d(BottomTipNormals[i].X(), BottomTipNormals[i].Y(), BottomTipNormals[i].Z());
      ObjVertex3d(tipFore.X(), tipFore.Y(), tipFore.Z());

      ObjNormal3d(BottomTipNormals[i + 1].X(), BottomTipNormals[i + 1].Y(), BottomTipNormals[i + 1].Z());
      ObjVertex3d(tipAft.X(), tipAft.Y(), tipAft.Z());

      ObjNormal3d(BottomRootNormals[i + 1].X(), BottomRootNormals[i + 1].Y(), BottomRootNormals[i + 1].Z());
      ObjVertex3d(rootAft.X(), rootAft.Y(), rootAft.Z());
      ObjEnd();
   }

   ObjPopMatrix();
}

void GeometryObjFile::DrawRoundedNacelle(double             aLength_ft,
                                         double             aHeight_ft,
                                         double             aWidth_ft,
                                         double             aThickness_ft,
                                         const std::string& aOverallShapeString,
                                         bool               aAftSectionIsTapered,
                                         double             aAftSectionLength_ft)
{
   double halfHeight = 0.5 * aHeight_ft;
   double halfWidth  = 0.5 * aWidth_ft;
   double offsetPosX = 0.0;
   double offsetPosY = 0.0;
   double offsetPosZ = 0.0;

   // Ensure zero aft length, if appropriate
   if (!aAftSectionIsTapered)
   {
      aAftSectionLength_ft = 0.0;
   }

   // Inlet ........................................................

   ObjPointCollection inletPointCollection(true, *this);

   // Draw rings in increasing x

   double inletX0          = offsetPosX + aLength_ft * 0.5;
   double inletHalfHeight0 = halfHeight - aThickness_ft;
   double inletHalfWidth0  = halfWidth - aThickness_ft;
   double inletX1          = offsetPosX + aLength_ft * 0.5 + 0.001 * aLength_ft;
   double inletHalfHeight1 = halfHeight * 0.001;
   double inletHalfWidth1  = halfWidth * 0.001;

   // Add center ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Add inlet outer radius ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   inletPointCollection.CalculatePointCollection();
   inletPointCollection.Draw();

   // Main portion of nacelle ......................................

   double exitLipLength  = aLength_ft * 0.15;
   double inletLipLength = aLength_ft * 0.075;
   if (aAftSectionIsTapered)
   {
      double maxLipLength = aLength_ft - aAftSectionLength_ft;
      if (inletLipLength > maxLipLength)
      {
         inletLipLength = maxLipLength - aLength_ft * 0.01;
      }

      // Modify values if necessary
      if (inletLipLength < aLength_ft * 0.01)
      {
         inletLipLength = aLength_ft * 0.01;
         aAftSectionLength_ft = aLength_ft * 0.98;
      }
   }

   ObjPointCollection pointCollection(true, *this);

   double x3          = offsetPosX + aLength_ft * 0.5;
   double halfHeight3 = halfHeight - aThickness_ft;
   double halfWidth3  = halfWidth - aThickness_ft;

   double x2          = offsetPosX + aLength_ft * 0.5 - inletLipLength;
   double halfHeight2 = halfHeight;
   double halfWidth2  = halfWidth;

   double x1          = 0.0;
   double halfHeight1 = 0.0;
   double halfWidth1  = 0.0;

   double x0          = 0.0;
   double halfHeight0 = 0.0;
   double halfWidth0  = 0.0;

   if (aAftSectionIsTapered)
   {
      x1          = offsetPosX - aLength_ft * 0.5 + aAftSectionLength_ft;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight * 0.001;
      halfWidth0  = halfWidth * 0.001;
   }
   else
   {
      x1          = offsetPosX - aLength_ft * 0.5 + exitLipLength;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight - aThickness_ft;
      halfWidth0  = halfWidth - aThickness_ft;
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   pointCollection.CalculatePointCollection();
   pointCollection.Draw();

   // Exit .........................................................

   if (!aAftSectionIsTapered)
   {
      ObjPointCollection exitPointCollection(true, *this);

      // Draw rings in increasing x

      inletX0          = offsetPosX - aLength_ft * 0.5 - 0.001 * aLength_ft;
      inletHalfHeight0 = halfHeight * 0.001;
      inletHalfWidth0  = halfWidth * 0.001;

      inletX1          = offsetPosX - aLength_ft * 0.5;
      inletHalfHeight1 = halfHeight - aThickness_ft;
      inletHalfWidth1  = halfWidth - aThickness_ft;

      // Add center ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt < 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 10; hgt > 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt > -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = -10; hgt < 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Add inlet outer radius ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt < 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 10; hgt > 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt > -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = -10; hgt < 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Calculate normals and draw
      exitPointCollection.CalculatePointCollection();
      exitPointCollection.Draw();
   }
}

void GeometryObjFile::DrawRoundedRightNacelle(double             aLength_ft,
                                              double             aHeight_ft,
                                              double             aWidth_ft,
                                              double             aThickness_ft,
                                              const std::string& aOverallShapeString,
                                              bool               aAftSectionIsTapered,
                                              double             aAftSectionLength_ft)
{
   double halfHeight = 0.5 * aHeight_ft;
   double halfWidth = 0.5 * aWidth_ft;
   double offsetPosX = 0.0;
   double offsetPosY = 0.0;
   double offsetPosZ = 0.0;

   // Ensure zero aft length, if appropriate
   if (!aAftSectionIsTapered)
   {
      aAftSectionLength_ft = 0.0;
   }

   // Inlet ........................................................

   ObjPointCollection inletPointCollection(true, *this);

   // Draw rings in increasing x

   double inletX0          = offsetPosX + aLength_ft * 0.5;
   double inletHalfHeight0 = halfHeight - aThickness_ft;
   double inletHalfWidth0  = halfWidth - aThickness_ft;

   double inletX1          = offsetPosX + aLength_ft * 0.5 + 0.001 * aLength_ft;
   double inletHalfHeight1 = halfHeight * 0.001;
   double inletHalfWidth1  = halfWidth * 0.001;

   // Add center ring
   inletPointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Add inlet outer radius ring
   inletPointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   inletPointCollection.CalculatePointCollection();
   inletPointCollection.Draw();

   // Main portion of nacelle ......................................

   double exitLipLength  = aLength_ft * 0.15;
   double inletLipLength = aLength_ft * 0.075;

   if (aAftSectionIsTapered)
   {
      double maxLipLength = aLength_ft - aAftSectionLength_ft;
      if (inletLipLength > maxLipLength)
      {
         inletLipLength = maxLipLength - aLength_ft * 0.01;
      }

      // Modify values if necessary
      if (inletLipLength < aLength_ft * 0.01)
      {
         inletLipLength = aLength_ft * 0.01;
         aAftSectionLength_ft = aLength_ft * 0.98;
      }
   }

   ObjPointCollection pointCollection(true, *this);

   double x3          = offsetPosX + aLength_ft * 0.5;
   double halfHeight3 = halfHeight - aThickness_ft;
   double halfWidth3  = halfWidth - aThickness_ft;

   double x2          = offsetPosX + aLength_ft * 0.5 - inletLipLength;
   double halfHeight2 = halfHeight;
   double halfWidth2  = halfWidth;

   double x1          = 0.0;
   double halfHeight1 = 0.0;
   double halfWidth1  = 0.0;

   double x0          = 0.0;
   double halfHeight0 = 0.0;
   double halfWidth0  = 0.0;

   if (aAftSectionIsTapered)
   {
      x1 = offsetPosX - aLength_ft * 0.5 + aAftSectionLength_ft;
      halfHeight1 = halfHeight;
      halfWidth1 = halfWidth;

      x0 = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight * 0.001;
      halfWidth0 = halfWidth * 0.001;
   }
   else
   {
      x1 = offsetPosX - aLength_ft * 0.5 + exitLipLength;
      halfHeight1 = halfHeight;
      halfWidth1 = halfWidth;

      x0 = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight - aThickness_ft;
      halfWidth0 = halfWidth - aThickness_ft;
   }

   pointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = -10; hgt < 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt <= 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   pointCollection.CalculatePointCollection();
   pointCollection.Draw();

   // Exit .........................................................

   if (!aAftSectionIsTapered)
   {
      ObjPointCollection exitPointCollection(true, *this);

      // Draw rings in increasing x

      inletX0          = offsetPosX - aLength_ft * 0.5 - 0.001 * aLength_ft;
      inletHalfHeight0 = halfHeight * 0.001;
      inletHalfWidth0  = halfWidth * 0.001;

      inletX1          = offsetPosX - aLength_ft * 0.5;
      inletHalfHeight1 = halfHeight - aThickness_ft;
      inletHalfWidth1  = halfWidth - aThickness_ft;

      // Add center ring
      exitPointCollection.AddRing();
      for (int hgt = -10; hgt < 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt <= 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Add inlet outer radius ring
      exitPointCollection.AddRing();
      for (int hgt = -10; hgt < 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt <= 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Calculate normals and draw
      exitPointCollection.CalculatePointCollection();
      exitPointCollection.Draw();
   }
}

void GeometryObjFile::DrawRoundedLeftNacelle(double             aLength_ft,
                                             double             aHeight_ft,
                                             double             aWidth_ft,
                                             double             aThickness_ft,
                                             const std::string& aOverallShapeString,
                                             bool               aAftSectionIsTapered,
                                             double             aAftSectionLength_ft)
{
   double halfHeight = 0.5 * aHeight_ft;
   double halfWidth  = 0.5 * aWidth_ft;
   double offsetPosX = 0.0;
   double offsetPosY = 0.0;
   double offsetPosZ = 0.0;

   // Ensure zero aft length, if appropriate
   if (!aAftSectionIsTapered)
   {
      aAftSectionLength_ft = 0.0;
   }

   // Inlet ........................................................

   ObjPointCollection inletPointCollection(true, *this);

   // Draw rings in increasing x

   double inletX0          = offsetPosX + aLength_ft * 0.5;
   double inletHalfHeight0 = halfHeight - aThickness_ft;
   double inletHalfWidth0  = halfWidth - aThickness_ft;

   double inletX1          = offsetPosX + aLength_ft * 0.5 + 0.001 * aLength_ft;
   double inletHalfHeight1 = halfHeight * 0.001;
   double inletHalfWidth1  = halfWidth * 0.001;

   // Add center ring
   inletPointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Add inlet outer radius ring
   inletPointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   inletPointCollection.CalculatePointCollection();
   inletPointCollection.Draw();

   // Main portion of nacelle ......................................

   double exitLipLength  = aLength_ft * 0.15;
   double inletLipLength = aLength_ft * 0.075;

   if (aAftSectionIsTapered)
   {
      double maxLipLength = aLength_ft - aAftSectionLength_ft;
      if (inletLipLength > maxLipLength)
      {
         inletLipLength = maxLipLength - aLength_ft * 0.01;
      }

      // Modify values if necessary
      if (inletLipLength < aLength_ft * 0.01)
      {
         inletLipLength = aLength_ft * 0.01;
         aAftSectionLength_ft = aLength_ft * 0.98;
      }
   }

   ObjPointCollection pointCollection(true, *this);

   double x3          = offsetPosX + aLength_ft * 0.5;
   double halfHeight3 = halfHeight - aThickness_ft;
   double halfWidth3  = halfWidth - aThickness_ft;

   double x2          = offsetPosX + aLength_ft * 0.5 - inletLipLength;
   double halfHeight2 = halfHeight;
   double halfWidth2  = halfWidth;

   double x1          = 0.0;
   double halfHeight1 = 0.0;
   double halfWidth1  = 0.0;

   double x0          = 0.0;
   double halfHeight0 = 0.0;
   double halfWidth0  = 0.0;

   if (aAftSectionIsTapered)
   {
      x1          = offsetPosX - aLength_ft * 0.5 + aAftSectionLength_ft;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight * 0.001;
      halfWidth0  = halfWidth * 0.001;
   }
   else
   {
      x1          = offsetPosX - aLength_ft * 0.5 + exitLipLength;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight - aThickness_ft;
      halfWidth0  = halfWidth - aThickness_ft;
   }

   pointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 10; hgt > 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 0; hgt >= -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   pointCollection.CalculatePointCollection();
   pointCollection.Draw();

   // Exit .........................................................

   if (!aAftSectionIsTapered)
   {
      ObjPointCollection exitPointCollection(true, *this);

      // Draw rings in increasing x

      inletX0          = offsetPosX - aLength_ft * 0.5 - 0.001 * aLength_ft;
      inletHalfHeight0 = halfHeight * 0.001;
      inletHalfWidth0  = halfWidth * 0.001;

      inletX1          = offsetPosX - aLength_ft * 0.5;
      inletHalfHeight1 = halfHeight - aThickness_ft;
      inletHalfWidth1  = halfWidth - aThickness_ft;

      // Add center ring
      exitPointCollection.AddRing();
      for (int hgt = 10; hgt > 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt >= -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Add inlet outer radius ring
      exitPointCollection.AddRing();
      for (int hgt = 10; hgt > 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 0; hgt >= -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Calculate normals and draw
      exitPointCollection.CalculatePointCollection();
      exitPointCollection.Draw();
   }
}

void GeometryObjFile::DrawRoundedTopNacelle(double             aLength_ft,
                                            double             aHeight_ft,
                                            double             aWidth_ft,
                                            double             aThickness_ft,
                                            const std::string& aOverallShapeString,
                                            bool               aAftSectionIsTapered,
                                            double             aAftSectionLength_ft)
{
   double halfHeight = 0.5 * aHeight_ft;
   double halfWidth  = 0.5 * aWidth_ft;
   double offsetPosX = 0.0;
   double offsetPosY = 0.0;
   double offsetPosZ = 0.0;

   // Ensure zero aft length, if appropriate
   if (!aAftSectionIsTapered)
   {
      aAftSectionLength_ft = 0.0;
   }

   // Inlet ........................................................

   ObjPointCollection inletPointCollection(true, *this);

   // Draw rings in increasing x

   double inletX0          = offsetPosX + aLength_ft * 0.5;
   double inletHalfHeight0 = halfHeight - aThickness_ft;
   double inletHalfWidth0  = halfWidth - aThickness_ft;

   double inletX1          = offsetPosX + aLength_ft * 0.5 + 0.001 * aLength_ft;
   double inletHalfHeight1 = halfHeight * 0.001;
   double inletHalfWidth1  = halfWidth * 0.001;

   // Add center ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Add inlet outer radius ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   inletPointCollection.CalculatePointCollection();
   inletPointCollection.Draw();

   // Main portion of nacelle ......................................

   double exitLipLength  = aLength_ft * 0.15;
   double inletLipLength = aLength_ft * 0.075;

   if (aAftSectionIsTapered)
   {
      double maxLipLength = aLength_ft - aAftSectionLength_ft;
      if (inletLipLength > maxLipLength)
      {
         inletLipLength = maxLipLength - aLength_ft * 0.01;
      }

      // Modify values if necessary
      if (inletLipLength < aLength_ft * 0.01)
      {
         inletLipLength       = aLength_ft * 0.01;
         aAftSectionLength_ft = aLength_ft * 0.98;
      }
   }

   ObjPointCollection pointCollection(true, *this);

   double x3          = offsetPosX + aLength_ft * 0.5;
   double halfHeight3 = halfHeight - aThickness_ft;
   double halfWidth3  = halfWidth - aThickness_ft;

   double x2          = offsetPosX + aLength_ft * 0.5 - inletLipLength;
   double halfHeight2 = halfHeight;
   double halfWidth2  = halfWidth;

   double x1          = 0.0;
   double halfHeight1 = 0.0;
   double halfWidth1  = 0.0;

   double x0          = 0.0;
   double halfHeight0 = 0.0;
   double halfWidth0  = 0.0;

   if (aAftSectionIsTapered)
   {
      x1          = offsetPosX - aLength_ft * 0.5 + aAftSectionLength_ft;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight * 0.001;
      halfWidth0  = halfWidth * 0.001;
   }
   else
   {
      x1          = offsetPosX - aLength_ft * 0.5 + exitLipLength;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight - aThickness_ft;
      halfWidth0  = halfWidth - aThickness_ft;
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt < 10; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = 10; hgt >= 0; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   pointCollection.CalculatePointCollection();
   pointCollection.Draw();

   // Exit .........................................................

   if (!aAftSectionIsTapered)
   {
      ObjPointCollection exitPointCollection(true, *this);

      // Draw rings in increasing x

      inletX0          = offsetPosX - aLength_ft * 0.5 - 0.001 * aLength_ft;
      inletHalfHeight0 = halfHeight * 0.001;
      inletHalfWidth0  = halfWidth * 0.001;

      inletX1          = offsetPosX - aLength_ft * 0.5;
      inletHalfHeight1 = halfHeight - aThickness_ft;
      inletHalfWidth1  = halfWidth - aThickness_ft;

      // Add center ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt < 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 10; hgt >= 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Add inlet outer radius ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt < 10; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = 10; hgt >= 0; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Calculate normals and draw
      exitPointCollection.CalculatePointCollection();
      exitPointCollection.Draw();
   }
}

void GeometryObjFile::DrawRoundedBottomNacelle(double             aLength_ft,
                                               double             aHeight_ft,
                                               double             aWidth_ft,
                                               double             aThickness_ft,
                                               const std::string& aOverallShapeString,
                                               bool               aAftSectionIsTapered,
                                               double             aAftSectionLength_ft)
{
   double halfHeight = 0.5 * aHeight_ft;
   double halfWidth  = 0.5 * aWidth_ft;
   double offsetPosX = 0.0;
   double offsetPosY = 0.0;
   double offsetPosZ = 0.0;

   // Ensure zero aft length, if appropriate
   if (!aAftSectionIsTapered)
   {
      aAftSectionLength_ft = 0.0;
   }

   // Inlet ........................................................

   ObjPointCollection inletPointCollection(true, *this);

   // Draw rings in increasing x

   double inletX0          = offsetPosX + aLength_ft * 0.5;
   double inletHalfHeight0 = halfHeight - aThickness_ft;
   double inletHalfWidth0  = halfWidth - aThickness_ft;

   double inletX1          = offsetPosX + aLength_ft * 0.5 + 0.001 * aLength_ft;
   double inletHalfHeight1 = halfHeight * 0.001;
   double inletHalfWidth1  = halfWidth * 0.001;

   // Add center ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight0;
      double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX0;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Add inlet outer radius ring
   inletPointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * inletHalfHeight1;
      double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = inletX1;
      inletPointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   inletPointCollection.CalculatePointCollection();
   inletPointCollection.Draw();

   // Main portion of nacelle ......................................

   double exitLipLength  = aLength_ft * 0.15;
   double inletLipLength = aLength_ft * 0.075;

   if (aAftSectionIsTapered)
   {
      double maxLipLength = aLength_ft - aAftSectionLength_ft;
      if (inletLipLength > maxLipLength)
      {
         inletLipLength = maxLipLength - aLength_ft * 0.01;
      }

      // Modify values if necessary
      if (inletLipLength < aLength_ft * 0.01)
      {
         inletLipLength       = aLength_ft * 0.01;
         aAftSectionLength_ft = aLength_ft * 0.98;
      }
   }

   ObjPointCollection pointCollection(true, *this);

   double x3          = offsetPosX + aLength_ft * 0.5;
   double halfHeight3 = halfHeight - aThickness_ft;
   double halfWidth3  = halfWidth - aThickness_ft;

   double x2          = offsetPosX + aLength_ft * 0.5 - inletLipLength;
   double halfHeight2 = halfHeight;
   double halfWidth2  = halfWidth;

   double x1          = 0.0;
   double halfHeight1 = 0.0;
   double halfWidth1  = 0.0;

   double x0          = 0.0;
   double halfHeight0 = 0.0;
   double halfWidth0  = 0.0;

   if (aAftSectionIsTapered)
   {
      x1          = offsetPosX - aLength_ft * 0.5 + aAftSectionLength_ft;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight * 0.001;
      halfWidth0  = halfWidth * 0.001;
   }
   else
   {
      x1          = offsetPosX - aLength_ft * 0.5 + exitLipLength;
      halfHeight1 = halfHeight;
      halfWidth1  = halfWidth;

      x0          = offsetPosX - aLength_ft * 0.5;
      halfHeight0 = halfHeight - aThickness_ft;
      halfWidth0  = halfWidth - aThickness_ft;
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = -EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight0;
      double z = EllipticalX_GivenY(y, halfWidth0, halfHeight0);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x0;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = -EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight1;
      double z = EllipticalX_GivenY(y, halfWidth1, halfHeight1);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x1;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = -EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight2;
      double z = EllipticalX_GivenY(y, halfWidth2, halfHeight2);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x2;
      pointCollection.AddPoint(x, y, z);
   }

   pointCollection.AddRing();
   for (int hgt = 0; hgt > -10; --hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = -EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }
   for (int hgt = -10; hgt <= 0; ++hgt)
   {
      double y = 0.1 * (double)hgt * halfHeight3;
      double z = EllipticalX_GivenY(y, halfWidth3, halfHeight3);
      y += -offsetPosZ;
      z += offsetPosY;
      double x = x3;
      pointCollection.AddPoint(x, y, z);
   }

   // Calculate normals and draw
   pointCollection.CalculatePointCollection();
   pointCollection.Draw();

   // Exit .........................................................

   if (!aAftSectionIsTapered)
   {
      ObjPointCollection exitPointCollection(true, *this);

      // Draw rings in increasing x

      inletX0          = offsetPosX - aLength_ft * 0.5 - 0.001 * aLength_ft;
      inletHalfHeight0 = halfHeight * 0.001;
      inletHalfWidth0  = halfWidth * 0.001;

      inletX1          = offsetPosX - aLength_ft * 0.5;
      inletHalfHeight1 = halfHeight - aThickness_ft;
      inletHalfWidth1  = halfWidth - aThickness_ft;

      // Add center ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt > -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = -EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = -10; hgt <= 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight0;
         double z = EllipticalX_GivenY(y, inletHalfWidth0, inletHalfHeight0);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX0;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Add inlet outer radius ring
      exitPointCollection.AddRing();
      for (int hgt = 0; hgt > -10; --hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = -EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }
      for (int hgt = -10; hgt <= 0; ++hgt)
      {
         double y = 0.1 * (double)hgt * inletHalfHeight1;
         double z = EllipticalX_GivenY(y, inletHalfWidth1, inletHalfHeight1);
         y += -offsetPosZ;
         z += offsetPosY;
         double x = inletX1;
         exitPointCollection.AddPoint(x, y, z);
      }

      // Calculate normals and draw
      exitPointCollection.CalculatePointCollection();
      exitPointCollection.Draw();
   }
}

void GeometryObjFile::DrawFlatSidedNacelle(double             aLength_ft,
                                           double             aHeight_ft,
                                           double             aWidth_ft,
                                           double             aThickness_ft,
                                           double             aForwardSweepLength_ft,
                                           const std::string& aOverallShapeString,
                                           bool               aAftSectionIsTapered,
                                           double             aAftSectionLength_ft)
{
   // F = front, A = aft, T = top, B = bottom, R = right, L = right
   UtVec3dX ptFTR;
   UtVec3dX ptFTL;
   UtVec3dX ptFBR;
   UtVec3dX ptFBL;
   UtVec3dX ptATR;
   UtVec3dX ptATL;
   UtVec3dX ptABR;
   UtVec3dX ptABL;

   DrawBoxWithHole(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft);
}

void GeometryObjFile::DrawFlatSweptRightNacelle(double             aLength_ft,
                                                double             aHeightInner_ft,
                                                double             aHeightOuter_ft,
                                                double             aWidth_ft,
                                                double             aThickness_ft,
                                                double             aForwardSweepLength_ft,
                                                const std::string& aOverallShapeString,
                                                bool               aAftSectionIsTapered,
                                                double             aAftSectionLength_ft)
{
   // Check value for aAftSectionLength_ft
   if (!aAftSectionIsTapered) { aAftSectionLength_ft = 0.0; }

   // F = front, A = aft, T = top, B = bottom, R = right, L = right

   // Incremental length for offset for inlets
   double del = aLength_ft * 0.0001;
   double dx  = aForwardSweepLength_ft;
   double dy  = aHeightInner_ft * 0.5 - aHeightOuter_ft * 0.5;
   double dz  = aWidth_ft;

   double dxOverDz = dx / dz;
   double xOffset  = aThickness_ft * dxOverDz;
   double dyOverDz = dy / dz;
   double yOffset  = aThickness_ft * dyOverDz;

   UtVec3dX inletFTR(xOffset + del + aLength_ft * 0.5 - aForwardSweepLength_ft,
                     aHeightOuter_ft * 0.5 - aThickness_ft + yOffset, aWidth_ft - aThickness_ft);
   UtVec3dX inletFTL(-xOffset + del + aLength_ft * 0.5,
                     aHeightInner_ft * 0.5 - aThickness_ft - yOffset, aThickness_ft);
   UtVec3dX inletFBR(xOffset + del + aLength_ft * 0.5 - aForwardSweepLength_ft,
                     -aHeightOuter_ft * 0.5 + aThickness_ft - yOffset, aWidth_ft - aThickness_ft);
   UtVec3dX inletFBL(-xOffset + del + aLength_ft * 0.5,
                     -aHeightInner_ft * 0.5 + aThickness_ft + yOffset, aThickness_ft);

   UtVec3dX ptFTR(aLength_ft * 0.5 - aForwardSweepLength_ft,  aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptFTL(aLength_ft * 0.5,                           aHeightInner_ft * 0.5, 0.0);
   UtVec3dX ptFBR(aLength_ft * 0.5 - aForwardSweepLength_ft, -aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptFBL(aLength_ft * 0.5,                          -aHeightInner_ft * 0.5, 0.0);

   UtVec3dX ptATR(-aLength_ft * 0.5 + aAftSectionLength_ft, aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptATL(-aLength_ft * 0.5, aHeightInner_ft * 0.5, 0.0);
   UtVec3dX ptABR(-aLength_ft * 0.5 + aAftSectionLength_ft, -aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptABL(-aLength_ft * 0.5, -aHeightInner_ft * 0.5, 0.0);

   UtVec3dX vec1;
   UtVec3dX vec2;
   UtVec3dX norm;

   // Front
   ObjBegin();
   vec1 = ptFTL - ptFBL;
   vec2 = ptFBR - ptFBL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjEnd();

   // Aft
   ObjBegin();
   vec1 = ptABR - ptABL;
   vec2 = ptATL - ptABL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjEnd();

   // Top
   ObjBegin();
   vec1 = ptATL - ptFTL;
   vec2 = ptATR - ptFTL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjEnd();

   // Bottom
   ObjBegin();
   vec1 = ptFBR - ptFBL;
   vec2 = ptABL - ptFBL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjEnd();

   // Right
   ObjBegin();
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjEnd();

   // Left
   ObjBegin();
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjEnd();
}

void GeometryObjFile::DrawFlatSweptLeftNacelle(double             aLength_ft,
                                               double             aHeightInner_ft,
                                               double             aHeightOuter_ft,
                                               double             aWidth_ft,
                                               double             aThickness_ft,
                                               double             aForwardSweepLength_ft,
                                               const std::string& aOverallShapeString,
                                               bool               aAftSectionIsTapered,
                                               double             aAftSectionLength_ft)
{
   // Check value for aAftSectionLength_ft
   if (!aAftSectionIsTapered) { aAftSectionLength_ft = 0.0; }

   // F = front, A = aft, T = top, B = bottom, R = right, L = right

   // Incremental length for offset for inlets
   double del = aLength_ft * 0.0001;
   double dx = aForwardSweepLength_ft;
   double dy = aHeightInner_ft * 0.5 - aHeightOuter_ft * 0.5;
   double dz = aWidth_ft;

   double dxOverDz = dx / dz;
   double xOffset = aThickness_ft * dxOverDz;
   double dyOverDz = dy / dz;
   double yOffset = aThickness_ft * dyOverDz;

   UtVec3dX inletFTR(xOffset + del + aLength_ft * 0.5,                            aHeightOuter_ft * 0.5 - aThickness_ft + yOffset, aWidth_ft - aThickness_ft);
   UtVec3dX inletFTL(-xOffset + del + aLength_ft * 0.5 - aForwardSweepLength_ft,  aHeightInner_ft * 0.5 - aThickness_ft - yOffset, aThickness_ft);
   UtVec3dX inletFBR(xOffset + del + aLength_ft * 0.5,                           -aHeightOuter_ft * 0.5 + aThickness_ft - yOffset, aWidth_ft - aThickness_ft);
   UtVec3dX inletFBL(-xOffset + del + aLength_ft * 0.5 - aForwardSweepLength_ft, -aHeightInner_ft * 0.5 + aThickness_ft + yOffset, aThickness_ft);

   UtVec3dX ptFTR(aLength_ft * 0.5,                           aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptFTL(aLength_ft * 0.5 - aForwardSweepLength_ft,  aHeightInner_ft * 0.5, 0.0);
   UtVec3dX ptFBR(aLength_ft * 0.5,                          -aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptFBL(aLength_ft * 0.5 - aForwardSweepLength_ft, -aHeightInner_ft * 0.5, 0.0);

   UtVec3dX ptATR(-aLength_ft * 0.5 + aAftSectionLength_ft, aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptATL(-aLength_ft * 0.5, aHeightInner_ft * 0.5, 0.0);
   UtVec3dX ptABR(-aLength_ft * 0.5 + aAftSectionLength_ft, -aHeightOuter_ft * 0.5, aWidth_ft);
   UtVec3dX ptABL(-aLength_ft * 0.5, -aHeightInner_ft * 0.5, 0.0);

   UtVec3dX vec1;
   UtVec3dX vec2;
   UtVec3dX norm;

   // Front
   ObjBegin();
   vec1 = ptFTL - ptFBL;
   vec2 = ptFBR - ptFBL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjEnd();

   // Aft
   ObjBegin();
   vec1 = ptABR - ptABL;
   vec2 = ptATL - ptABL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjEnd();

   // Top
   ObjBegin();
   vec1 = ptATL - ptFTL;
   vec2 = ptATR - ptFTL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjEnd();

   // Bottom
   ObjBegin();
   vec1 = ptFBR - ptFBL;
   vec2 = ptABL - ptFBL;
   norm = vec1.Cross(vec2);
   norm.Normalize();
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(norm.X(), norm.Y(), norm.Z());
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjEnd();

   // Right
   ObjBegin();
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptABR.X(), ptABR.Y(), ptABR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptFBR.X(), ptFBR.Y(), ptFBR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptFTR.X(), ptFTR.Y(), ptFTR.Z());
   ObjNormal3d(0.0, 0.0, 1.0);
   ObjVertex3d(ptATR.X(), ptATR.Y(), ptATR.Z());
   ObjEnd();

   // Left
   ObjBegin();
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptFTL.X(), ptFTL.Y(), ptFTL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptFBL.X(), ptFBL.Y(), ptFBL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptABL.X(), ptABL.Y(), ptABL.Z());
   ObjNormal3d(0.0, 0.0, -1.0);
   ObjVertex3d(ptATL.X(), ptATL.Y(), ptATL.Z());
   ObjEnd();
}

void GeometryObjFile::DrawNacelle(double             aPosX,
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
                                  double             aRoll_deg)
{
   ObjPushMatrix();
   ObjTranslated(aPosX, -aPosZ, aPosY);
   ObjRotated(aYaw_deg, 0.0, -1.0, 0.0);
   ObjRotated(aPitch_deg, 0.0, 0.0, 1.0);
   ObjRotated(aRoll_deg, 1.0, 0.0, 0.0);

   // Tapered flag
   bool aftNacelleIsTapered = false;
   if (aAftSectionString == "Blunt") { aftNacelleIsTapered = false; }
   else if (aAftSectionString == "Tapered") { aftNacelleIsTapered = true; }

   if (aftNacelleIsTapered)
   {
      // Verify length values - return if aft length is too long
      if (aAftSectionLength_ft > aLength_ft) { return; }
   }

   if (aOverallShapeString == "Rounded")
   {
      DrawRoundedNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aOverallShapeString,
                         aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Half-Round-Right")
   {
      DrawRoundedRightNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aOverallShapeString,
                              aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Half-Round-Left")
   {
      DrawRoundedLeftNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aOverallShapeString,
                             aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Half-Round-Top")
   {
      DrawRoundedTopNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aOverallShapeString,
                            aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Half-Round-Bottom")
   {
      DrawRoundedBottomNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aOverallShapeString,
                               aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Flat-Sided")
   {
      DrawFlatSidedNacelle(aLength_ft, aHeight_ft, aWidth_ft, aThickness_ft, aForwardSweepLength_ft,
                           aOverallShapeString, aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Flat-Swept-Right")
   {
      DrawFlatSweptRightNacelle(aLength_ft, aHeightInner_ft, aHeightOuter_ft, aWidth_ft, aThickness_ft,
                                aForwardSweepLength_ft, aOverallShapeString, aftNacelleIsTapered, aAftSectionLength_ft);
   }
   else if (aOverallShapeString == "Flat-Swept-Left")
   {
      DrawFlatSweptLeftNacelle(aLength_ft, aHeightInner_ft, aHeightOuter_ft, aWidth_ft, aThickness_ft,
                               aForwardSweepLength_ft, aOverallShapeString, aftNacelleIsTapered, aAftSectionLength_ft);
   }

   ObjPopMatrix();
}

double GeometryObjFile::EllipticalY_GivenX(double x, double aHalfWidth, double aHalfHeight)
{
   return sqrt((1 - ((x * x) / (aHalfWidth * aHalfWidth))) * (aHalfHeight * aHalfHeight));
}

double GeometryObjFile::EllipticalX_GivenY(double y, double aHalfWidth, double aHalfHeight)
{
   return sqrt((1 - ((y * y) / (aHalfHeight * aHalfHeight))) * (aHalfWidth * aHalfWidth));
}


}
