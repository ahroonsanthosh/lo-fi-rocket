/*
 * OpenRocket reference harness for lo-fi-rocket.
 *
 * Copyright (C) 2026 lo-fi-rocket contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * ---------------------------------------------------------------------
 * Black-box probe (plan 0059): trapezoidal, elliptical and freeform fin sets on
 * the same rocket: the fins' mass, CG, inertias, planform area and outline
 * points, and the fin set's and the rocket's CP and C_N alpha at Mach 0.3.
 * Saved, reloaded and measured as loaded. Output kept in
 * reference/rockets/fin-shape-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/FinShapeProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar FinShapeProbe
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.masscalc.MassCalculator;
import info.openrocket.core.masscalc.RigidBody;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.util.Locale;
import java.util.Map;

public final class FinShapeProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Case 0: trapezoid (root 0.1, tip 0.05, sweep 0.05, height 0.08); case 1: elliptical (root 0.1,
    // height 0.08); case 2: freeform (0,0) (0.03,0.06) (0.07,0.08) (0.1,0.04) (0.12,0).
    for (int c = 0; c <= 2; c++) run(c);
  }

  static void run(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("fins" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    FinSet fins;
    if (c == 0) {
      fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
    } else if (c == 1) {
      EllipticalFinSet e = new EllipticalFinSet();
      e.setFinCount(3); e.setLength(0.1); e.setHeight(0.08);
      fins = e;
    } else {
      FreeformFinSet f = new FreeformFinSet();
      f.setFinCount(3);
      f.setPoints(new Coordinate[] {
        new Coordinate(0, 0), new Coordinate(0.03, 0.06), new Coordinate(0.07, 0.08),
        new Coordinate(0.1, 0.04), new Coordinate(0.12, 0)});
      fins = f;
    }
    fins.setName("Fins"); fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    fins.setCrossSection(FinSet.CrossSection.SQUARE);
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    File file = new File("fins" + c + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(file).load().getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    FlightConditions fc = new FlightConditions(config);
    fc.setMach(0.3); fc.setAOA(0); fc.setRollRate(0);
    BarrowmanCalculator aero = new BarrowmanCalculator();
    Map<RocketComponent, AerodynamicForces> forces = aero.getForceAnalysis(config, fc, new WarningSet());
    for (RocketComponent k : loaded) {
      if (k instanceof FinSet) {
        FinSet fs = (FinSet) k;
        StringBuilder pts = new StringBuilder();
        Coordinate[] p = fs.getFinPoints();
        System.out.printf("case %d: points=%d first=(%.6f, %.6f) last=(%.6f, %.6f) planformArea=%.9e%n", c, p.length, p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y, fs.getPlanformArea());
        System.out.printf("case %d: fins absX0=%.9f mass=%.9f cgAbs=%.9f Irot_unit=%.9e Ilong_unit=%.9e%n", c,
            fs.toAbsolute(Coordinate.NUL)[0].x, fs.getMass(), fs.toAbsolute(fs.getCG())[0].x,
            fs.getRotationalUnitInertia(), fs.getLongitudinalUnitInertia());
        AerodynamicForces f = forces.get(k);
        System.out.printf("case %d: fin set CP x=%.9f CNa=%.9f%n", c, f.getCP().x, f.getCP().weight);
      }
    }
    Coordinate cp = aero.getWorstCP(config, fc, new WarningSet());
    RigidBody s = MassCalculator.calculateStructure(config);
    System.out.printf("case %d: rocket worst CP x=%.9f CNa=%.9f structure m=%.9f cg=%.9f%n", c, cp.x, cp.weight, s.getMass(), s.getCM().x);
  }
}
