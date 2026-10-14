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
 * Black-box probe (plan 0068): a flipped nose cone used as a tail cone,
 * against a transition of the same shape, length and radii ending at 0.
 * For each of the six shapes, both are built behind the same body tube,
 * saved, reloaded and measured as loaded: the part's radii as OpenRocket
 * reports them, its mass and CG, its CP and C_Na at Mach 0.3, and the
 * rocket's worst CP and structure mass and CG. Case "shoulder" adds an
 * aft shoulder to a flipped cone, and case "children" two mass components
 * inside one, at "top" and at "bottom". Output kept in
 * reference/rockets/flipped-nose-probe/. Run from an empty directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/FlippedNoseProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar FlippedNoseProbe
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

public final class FlippedNoseProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Object[][] shapes = {
      {Transition.Shape.CONICAL, 0.0}, {Transition.Shape.OGIVE, 1.0}, {Transition.Shape.ELLIPSOID, 0.0},
      {Transition.Shape.POWER, 0.5}, {Transition.Shape.PARABOLIC, 0.75}, {Transition.Shape.HAACK, 0.0},
    };
    for (Object[] s : shapes) {
      Transition.Shape shape = (Transition.Shape) s[0];
      double p = (Double) s[1];
      run(shape, p, true, false);
      run(shape, p, false, false);
    }
    run(Transition.Shape.OGIVE, 1.0, true, true);
    children();
  }

  /**
   * Case "flipped-ogive-children": two 10 g mass components inside a flipped ogive tail, one at
   * "top" + 0.01 m and one at "bottom" + 0, each 0.02 m long; their positions as loaded.
   */
  static void children() throws Exception {
    String name = "flipped-ogive-children";
    Rocket r = new Rocket(); r.setName(name);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.120, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.4, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    NoseCone tail = new NoseCone(Transition.Shape.OGIVE, 0.100, 0.025);
    tail.setShapeParameter(1.0); tail.setFlipped(true);
    tail.setName("Tail"); tail.setThickness(0.002); tail.setMaterial(bulk("abs1050", 1050));
    st.addChild(tail);
    tail.setAxialMethod(AxialMethod.AFTER); tail.setAxialOffset(0.0);
    MassComponent top = new MassComponent(0.02, 0.01, 0.01); top.setName("Top"); top.setComponentMass(0.01);
    tail.addChild(top); top.setAxialMethod(AxialMethod.TOP); top.setAxialOffset(0.01);
    MassComponent bottom = new MassComponent(0.02, 0.01, 0.01); bottom.setName("Bottom"); bottom.setComponentMass(0.01);
    tail.addChild(bottom); bottom.setAxialMethod(AxialMethod.BOTTOM); bottom.setAxialOffset(0.0);
    File file = new File(name + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(file).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof MassComponent) {
        System.out.printf("%s: child %s absX0=%.9f length=%.6f mass=%.9f cgAbs=%.9f%n", name, k.getName(),
            k.toAbsolute(Coordinate.NUL)[0].x, k.getLength(), k.getMass(), k.toAbsolute(k.getCG())[0].x);
      }
    }
    RigidBody s = MassCalculator.calculateStructure(loaded.getSelectedConfiguration());
    System.out.printf("%s: rocket structure m=%.9f cg=%.9f%n", name, s.getMass(), s.getCM().x);
  }

  static void run(Transition.Shape shape, double param, boolean flipped, boolean shoulder) throws Exception {
    String name = (flipped ? "flipped-" : "transition-") + shape.name().toLowerCase(Locale.US) + (shoulder ? "-shoulder" : "");
    Rocket r = new Rocket(); r.setName(name);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.120, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.4, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
    fins.setName("Fins"); fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    fins.setCrossSection(FinSet.CrossSection.SQUARE);
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    Transition tail;
    if (flipped) {
      NoseCone t = new NoseCone(shape, 0.100, 0.025);
      if (shape.usesParameter()) t.setShapeParameter(param);
      t.setFlipped(true);
      if (shoulder) { t.setShoulderLength(0.030); t.setShoulderRadius(0.024); t.setShoulderThickness(0.002); }
      tail = t;
    } else {
      Transition t = new Transition();
      t.setShapeType(shape);
      if (shape.usesParameter()) t.setShapeParameter(param);
      t.setLength(0.100);
      t.setForeRadiusAutomatic(false); t.setForeRadius(0.025);
      t.setAftRadiusAutomatic(false); t.setAftRadius(0.0);
      tail = t;
    }
    tail.setName("Tail"); tail.setThickness(0.002); tail.setMaterial(bulk("abs1050", 1050));
    st.addChild(tail);
    tail.setAxialMethod(AxialMethod.AFTER); tail.setAxialOffset(0.0);
    File file = new File(name + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(file).load().getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    FlightConditions fc = new FlightConditions(config);
    fc.setMach(0.3); fc.setAOA(0); fc.setRollRate(0);
    BarrowmanCalculator aero = new BarrowmanCalculator();
    Map<RocketComponent, AerodynamicForces> forces = aero.getForceAnalysis(config, fc, new WarningSet());
    for (RocketComponent k : loaded) {
      if (!"Tail".equals(k.getName())) continue;
      Transition t = (Transition) k;
      AerodynamicForces f = forces.get(k);
      System.out.printf("%s: class=%s foreRadius=%.6f aftRadius=%.6f length=%.6f absX0=%.9f mass=%.9f cgAbs=%.9f cp=%.9f cna=%.9f%n",
          name, k.getClass().getSimpleName(), t.getForeRadius(), t.getAftRadius(), t.getLength(),
          k.toAbsolute(Coordinate.NUL)[0].x, k.getMass(), k.toAbsolute(k.getCG())[0].x,
          f == null ? Double.NaN : f.getCP().x, f == null ? Double.NaN : f.getCP().weight);
    }
    Coordinate cp = aero.getWorstCP(config, fc, new WarningSet());
    RigidBody s = MassCalculator.calculateStructure(config);
    System.out.printf("%s: rocket worst CP x=%.9f CNa=%.9f structure m=%.9f cg=%.9f length=%.6f%n", name, cp.x, cp.weight, s.getMass(), s.getCM().x, loaded.getLength());
  }
}
