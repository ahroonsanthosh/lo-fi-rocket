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
 * Black-box probe (D-081): the mass, CG and inertias OpenRocket gives a fin
 * set with a fin tab, for each tab position reference (front, center, end),
 * and an engine block inside a motor tube. Saved, reloaded and measured as
 * loaded. Output kept in reference/rockets/tab-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/TabProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar TabProbe
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

public final class TabProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Case 0: no tab. Cases 1..3: tab 0.06 m long, 0.012 m high, offset 0.01 m relative to the
    // root's front, centre and end.
    AxialMethod[] rel = {null, AxialMethod.TOP, AxialMethod.MIDDLE, AxialMethod.BOTTOM};
    for (int c = 0; c <= 3; c++) run(c, rel[c]);
  }

  static void run(int c, AxialMethod rel) throws Exception {
    Rocket r = new Rocket(); r.setName("tab" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    // 3 fins: root 0.1, tip 0.05, sweep 0.05, height 0.08, 3 mm plywood.
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
    fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    if (rel != null) {
      fins.setTabHeight(0.012); fins.setTabLength(0.06);
      fins.setTabOffsetMethod(rel); fins.setTabOffset(0.01);
    }
    InnerTube mt = new InnerTube(); mt.setName("Motor tube"); mt.setLength(0.07); mt.setOuterRadius(0.0095); mt.setThickness(0.0005);
    mt.setMaterial(bulk("paper700", 700));
    bt.addChild(mt);
    mt.setAxialMethod(AxialMethod.BOTTOM); mt.setAxialOffset(0.0);
    if (c == 0) {
      EngineBlock eb = new EngineBlock(); eb.setName("Block"); eb.setLength(0.006); eb.setThickness(0.002); eb.setMaterial(bulk("paper700", 700));
      mt.addChild(eb);
      eb.setOuterRadiusAutomatic(true);
      eb.setAxialMethod(AxialMethod.TOP); eb.setAxialOffset(0.0);
    }
    File f = new File("tab" + c + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof FinSet) {
        FinSet fs = (FinSet) k;
        System.out.printf("case %d: tab=%s tabFrontEdge=%.9f fins absX0=%.9f mass=%.9f cgAbs=%.9f Irot_unit=%.9e Ilong_unit=%.9e%n", c,
            rel, fs.getTabFrontEdge(), fs.toAbsolute(Coordinate.NUL)[0].x, fs.getMass(), fs.toAbsolute(fs.getCG())[0].x,
            fs.getRotationalUnitInertia(), fs.getLongitudinalUnitInertia());
      }
      if (k instanceof EngineBlock) {
        EngineBlock eb = (EngineBlock) k;
        System.out.printf("case %d: engine block absX0=%.9f outer=%.9f inner=%.9f mass=%.9f cgAbs=%.9f%n", c,
            eb.toAbsolute(Coordinate.NUL)[0].x, eb.getOuterRadius(), eb.getInnerRadius(), eb.getMass(), eb.toAbsolute(eb.getCG())[0].x);
      }
    }
  }
}
