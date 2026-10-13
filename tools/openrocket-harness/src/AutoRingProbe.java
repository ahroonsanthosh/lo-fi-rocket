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
 * Black-box probe (D-080): the radii OpenRocket gives rings, bulkheads and
 * tube couplers whose radii are automatic (written as a bare "auto"), in a
 * body tube, around an inner tube, in a nose cone and in a tube coupler, and
 * where it places components inside a tube coupler. Saved, reloaded and
 * measured as loaded. Output kept in reference/rockets/auto-ring-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/AutoRingProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar AutoRingProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.util.Locale;

public final class AutoRingProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  static <T extends RocketComponent> T at(RocketComponent parent, T child, AxialMethod m, double offset) {
    parent.addChild(child);
    child.setAxialMethod(m); child.setAxialOffset(offset);
    return child;
  }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Rocket r = new Rocket(); r.setName("autoring");
    AxialStage st = new AxialStage(); r.addChild(st);
    // Ogive nose 0.15 m, base radius 0.025 m, wall 0.002 m, with an automatic bulkhead 0.005 m thick
    // at its aft end and another 0.03 m from the tip.
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.150, 0.025);
    nose.setThickness(0.002); nose.setMaterial(bulk("abs1050", 1050));
    st.addChild(nose);
    Bulkhead nb1 = new Bulkhead(); nb1.setName("Nose bulkhead aft"); nb1.setLength(0.005); nb1.setMaterial(bulk("ply600", 600));
    at(nose, nb1, AxialMethod.BOTTOM, 0.0); nb1.setOuterRadiusAutomatic(true);
    Bulkhead nb2 = new Bulkhead(); nb2.setName("Nose bulkhead fore"); nb2.setLength(0.005); nb2.setMaterial(bulk("ply600", 600));
    at(nose, nb2, AxialMethod.TOP, 0.03); nb2.setOuterRadiusAutomatic(true);
    // Body tube 0.5 m, radius 0.025 m, wall 0.001 m.
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    // Motor tube 0.07 m at the aft end, outer radius 0.0095 m.
    InnerTube mt = new InnerTube(); mt.setName("Motor tube"); mt.setLength(0.07); mt.setOuterRadius(0.0095); mt.setThickness(0.0005);
    mt.setMaterial(bulk("paper700", 700));
    at(bt, mt, AxialMethod.BOTTOM, 0.0);
    // Centering rings with automatic outer and inner radii: one at the motor tube's fore end, one
    // overlapping it at the aft end; a bulkhead with an automatic radius forward of the motor tube.
    CenteringRing cr1 = new CenteringRing(); cr1.setName("Ring fore"); cr1.setLength(0.005); cr1.setMaterial(bulk("ply600", 600));
    at(bt, cr1, AxialMethod.BOTTOM, -0.065); cr1.setOuterRadiusAutomatic(true); cr1.setInnerRadiusAutomatic(true);
    CenteringRing cr2 = new CenteringRing(); cr2.setName("Ring aft"); cr2.setLength(0.005); cr2.setMaterial(bulk("ply600", 600));
    at(bt, cr2, AxialMethod.BOTTOM, 0.0); cr2.setOuterRadiusAutomatic(true); cr2.setInnerRadiusAutomatic(true);
    CenteringRing cr3 = new CenteringRing(); cr3.setName("Ring clear"); cr3.setLength(0.005); cr3.setMaterial(bulk("ply600", 600));
    at(bt, cr3, AxialMethod.TOP, 0.25); cr3.setOuterRadiusAutomatic(true); cr3.setInnerRadiusAutomatic(true);
    Bulkhead bh = new Bulkhead(); bh.setName("Body bulkhead"); bh.setLength(0.006); bh.setMaterial(bulk("ply600", 600));
    at(bt, bh, AxialMethod.TOP, 0.1); bh.setOuterRadiusAutomatic(true);
    // Tube coupler with an automatic outer radius at the fore end, with a bulkhead (automatic) and a
    // mass component inside it.
    TubeCoupler tc = new TubeCoupler(); tc.setName("Coupler"); tc.setLength(0.08); tc.setThickness(0.0015); tc.setMaterial(bulk("paper700", 700));
    at(bt, tc, AxialMethod.TOP, 0.0); tc.setOuterRadiusAutomatic(true);
    Bulkhead cb = new Bulkhead(); cb.setName("Coupler bulkhead"); cb.setLength(0.004); cb.setMaterial(bulk("ply600", 600));
    at(tc, cb, AxialMethod.MIDDLE, 0.0); cb.setOuterRadiusAutomatic(true);
    MassComponent cm = new MassComponent(0.02, 0.01, 0.025); cm.setName("Coupler mass");
    at(tc, cm, AxialMethod.BOTTOM, -0.01);

    File f = new File("autoring.ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof Rocket || k instanceof AxialStage) continue;
      String extra = "";
      if (k instanceof RadiusRingComponent || k instanceof ThicknessRingComponent) {
        RingComponent rc = (RingComponent) k;
        extra = String.format(" outer=%.9f inner=%.9f", rc.getOuterRadius(), rc.getInnerRadius());
      }
      System.out.printf("%s \"%s\" absX0=%.9f length=%.6f mass=%.9f cgAbs=%.9f%s%n", k.getClass().getSimpleName(), k.getName(),
          k.toAbsolute(Coordinate.NUL)[0].x, k.getLength(), k.getMass(), k.toAbsolute(k.getCG())[0].x, extra);
    }
  }
}
