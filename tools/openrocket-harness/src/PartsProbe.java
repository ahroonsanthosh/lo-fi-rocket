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
 * Black-box probe (D-079): mass and CG of a parachute whose mass comes from
 * its canopy and line materials, the drag coefficient OpenRocket uses for an
 * automatic parachute C_D, and the mass and CG of a shock cord, a tube
 * coupler and an engine block. Each case is saved, reloaded and measured as
 * loaded. Output kept in reference/rockets/parts-probe/. Run from an empty
 * directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/PartsProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar PartsProbe
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

public final class PartsProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    Rocket r = new Rocket(); r.setName("parts");
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);

    // Parachute: 0.6 m canopy of 0.067 kg/m² ripstop, 8 lines of 0.5 m at 0.0018 kg/m, automatic C_D.
    Parachute p = new Parachute(); p.setName("Chute");
    p.setDiameter(0.6); p.setLength(0.06); p.setRadius(0.015);
    p.setMaterial(Material.newMaterial(Material.Type.SURFACE, "ripstop67", 0.067, true));
    p.setLineCount(8); p.setLineLength(0.5);
    p.setLineMaterial(Material.newMaterial(Material.Type.LINE, "line18", 0.0018, true));
    p.setCDAutomatic(true);
    bt.addChild(p);
    p.setAxialMethod(AxialMethod.TOP); p.setAxialOffset(0.02);

    // Shock cord: 1.5 m of 0.005 kg/m, packed 0.03 m long, radius 0.01 m.
    ShockCord sc = new ShockCord(); sc.setName("Cord");
    sc.setCordLength(1.5); sc.setMaterial(Material.newMaterial(Material.Type.LINE, "cord5", 0.005, true));
    sc.setLength(0.03); sc.setRadius(0.01);
    bt.addChild(sc);
    sc.setAxialMethod(AxialMethod.TOP); sc.setAxialOffset(0.09);

    // Tube coupler: 0.08 m long, outer radius 0.024 m, wall 0.0015 m, paper.
    TubeCoupler tc = new TubeCoupler(); tc.setName("Coupler");
    tc.setLength(0.08); tc.setOuterRadius(0.024); tc.setThickness(0.0015); tc.setMaterial(bulk("paper700", 700));
    bt.addChild(tc);
    tc.setAxialMethod(AxialMethod.MIDDLE); tc.setAxialOffset(0.0);

    // Engine block: 0.006 m long, outer radius 0.0095 m, wall 0.003 m, paper.
    EngineBlock eb = new EngineBlock(); eb.setName("Block");
    eb.setLength(0.006); eb.setOuterRadius(0.0095); eb.setThickness(0.003); eb.setMaterial(bulk("paper700", 700));
    bt.addChild(eb);
    eb.setAxialMethod(AxialMethod.BOTTOM); eb.setAxialOffset(-0.07);

    File f = new File("parts.ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof Rocket || k instanceof AxialStage) continue;
      String extra = "";
      if (k instanceof Parachute) extra = String.format(" cd=%.9f cdAutomatic=%b", ((Parachute) k).getCD(), ((Parachute) k).isCDAutomatic());
      if (k instanceof RingComponent) extra = String.format(" outer=%.6f inner=%.6f", ((RingComponent) k).getOuterRadius(), ((RingComponent) k).getInnerRadius());
      System.out.printf("%s \"%s\" absX0=%.9f length=%.6f mass=%.9f cgAbs=%.9f%s%n", k.getClass().getSimpleName(), k.getName(),
          k.toAbsolute(Coordinate.NUL)[0].x, k.getLength(), k.getMass(), k.toAbsolute(k.getCG())[0].x, extra);
    }
  }
}
