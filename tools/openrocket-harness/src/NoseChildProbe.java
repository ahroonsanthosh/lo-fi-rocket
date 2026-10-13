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
 * Black-box probe: where OpenRocket places components inside a nose cone,
 * for each axial method, with and without an aft shoulder. Prints each
 * child's absolute fore-end position and the structure CG, and saves each
 * (case 8 uses only features the minimal .ork reader accepts: a fixed parachute
 * C_D and mass, and a bulkhead with an explicit radius)
 * rocket as nosechild<N>.ork. Output kept in reference/rockets/nose-child-probe/.
 * Run from an empty directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/NoseChildProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar NoseChildProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.masscalc.*;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.util.Locale;

public final class NoseChildProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Cases 0..3: a mass component with method TOP, BOTTOM, MIDDLE, ABSOLUTE, no shoulder.
    // Cases 4..7: the same with a 40 mm aft shoulder.
    // Case 8: shoulder, plus a parachute (BOTTOM) and a bulkhead (BOTTOM) inside the nose.
    AxialMethod[] m = {AxialMethod.TOP, AxialMethod.BOTTOM, AxialMethod.MIDDLE, AxialMethod.ABSOLUTE};
    double[] off = {0.01, -0.005, 0.003, 0.05};
    for (int c = 0; c <= 8; c++) run(c, m[c % 4], off[c % 4], c >= 4);
  }
  static void run(int c, AxialMethod method, double offset, boolean shoulder) throws Exception {
    Rocket r = new Rocket(); r.setName("nosechild" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.150, 0.025);
    nose.setThickness(0.002); nose.setMaterial(bulk("abs1050", 1050));
    if (shoulder) { nose.setAftShoulderLength(0.040); nose.setAftShoulderRadius(0.023); nose.setAftShoulderThickness(0.002); }
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    MassComponent mc = new MassComponent(0.02, 0.01, 0.03);
    // Attached first, then positioned: OpenRocket resolves the method against the parent when the offset is set.
    nose.addChild(mc);
    mc.setAxialMethod(method); mc.setAxialOffset(offset);
    Parachute p = null; Bulkhead b = null;
    if (c == 8) {
      p = new Parachute(); p.setLength(0.05); p.setRadius(0.012); p.setCD(0.8);
      p.setMassOverridden(true); p.setOverrideMass(0.012);
      nose.addChild(p);
      p.setAxialMethod(AxialMethod.BOTTOM); p.setAxialOffset(-0.01);
      b = new Bulkhead(); b.setLength(0.005); b.setMaterial(bulk("ply600", 600));
      nose.addChild(b);
      b.setOuterRadiusAutomatic(false); b.setOuterRadius(0.020);
      b.setAxialMethod(AxialMethod.BOTTOM); b.setAxialOffset(0.0);
    }
    // Save, then measure the rocket as OpenRocket loads it from the file, as a user's file is opened:
    // a rocket built in memory keeps stale stacking positions.
    File f = new File("nosechild" + c + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    OpenRocketDocument doc = new GeneralRocketLoader(f).load();
    Rocket loaded = doc.getRocket();
    FlightConfiguration cfg = loaded.getSelectedConfiguration();
    cfg.setAllStages();
    RigidBody s = MassCalculator.calculateStructure(cfg);
    System.out.printf("case %d: method=%s offset=%.4f shoulder=%b structure m=%.9f cg=%.9f%n",
        c, method, offset, shoulder, s.getMass(), s.getCM().x);
    for (RocketComponent k : loaded) {
      if (k instanceof Rocket || k instanceof AxialStage) continue;
      String extra = k instanceof Bulkhead ? String.format(" outerRadius=%.6f", ((Bulkhead) k).getOuterRadius()) : "";
      System.out.printf("   %s absX0=%.9f length=%.6f mass=%.9f cgAbs=%.9f%s%n", k.getClass().getSimpleName(),
          k.toAbsolute(Coordinate.NUL)[0].x, k.getLength(), k.getMass(), k.toAbsolute(k.getCG())[0].x, extra);
    }
  }
}
