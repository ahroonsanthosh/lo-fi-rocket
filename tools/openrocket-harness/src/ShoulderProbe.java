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
 * Black-box probe (D-078): the mass and CG OpenRocket gives a nose cone or
 * transition shoulder that is capped, or has zero wall thickness, and what
 * an "auto" radius resolves to. Each case is saved, reloaded and measured as
 * loaded. Output kept in reference/rockets/shoulder-probe/. Run from an empty
 * directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ShoulderProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar ShoulderProbe
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

public final class ShoulderProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Nose cone shoulder (radius 0.023, length 0.040): 0 open, thickness 0.002;
    // 1 capped, thickness 0.002; 2 open, thickness 0; 3 capped, thickness 0.
    // Case 4: nose cone, body tube and transition with automatic radii.
    for (int c = 0; c <= 3; c++) shoulder(c);
    auto();
  }

  static Rocket saveAndLoad(Rocket r, String file) throws Exception {
    File f = new File(file);
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    return new GeneralRocketLoader(f).load().getRocket();
  }

  static void shoulder(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("shoulder" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.150, 0.025);
    nose.setThickness(0.002); nose.setMaterial(bulk("abs1050", 1050));
    nose.setAftShoulderLength(0.040); nose.setAftShoulderRadius(0.023);
    nose.setAftShoulderThickness(c >= 2 ? 0.0 : 0.002);
    nose.setAftShoulderCapped(c == 1 || c == 3);
    st.addChild(nose);
    Rocket loaded = saveAndLoad(r, "shoulder" + c + ".ork");
    for (RocketComponent k : loaded) {
      if (k instanceof NoseCone) {
        System.out.printf("case %d: shoulderThickness=%.4f capped=%b noseMass=%.9f cg=%.9f%n", c,
            ((NoseCone) k).getAftShoulderThickness(), ((NoseCone) k).isAftShoulderCapped(), k.getMass(), k.getCG().x);
      }
    }
  }

  static void auto() throws Exception {
    Rocket r = new Rocket(); r.setName("shoulder4");
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.150, 0.025);
    nose.setThickness(0.002); nose.setMaterial(bulk("abs1050", 1050));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.3, 0.031, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    Transition tr = new Transition(); tr.setLength(0.05); tr.setForeRadius(0.031); tr.setAftRadius(0.02);
    tr.setThickness(0.001); tr.setMaterial(bulk("paper700", 700));
    st.addChild(tr);
    tr.setAxialMethod(AxialMethod.AFTER); tr.setAxialOffset(0.0);
    nose.setAftRadiusAutomatic(true);
    tr.setForeRadiusAutomatic(true);
    Rocket loaded = saveAndLoad(r, "shoulder4.ork");
    for (RocketComponent k : loaded) {
      if (k instanceof NoseCone) System.out.printf("case 4: nose aftRadius=%.9f automatic=%b%n", ((NoseCone) k).getAftRadius(), ((NoseCone) k).isAftRadiusAutomatic());
      else if (k instanceof Transition) System.out.printf("case 4: transition foreRadius=%.9f automatic=%b%n", ((Transition) k).getForeRadius(), ((Transition) k).isForeRadiusAutomatic());
      else if (k instanceof BodyTube) System.out.printf("case 4: body tube outerRadius=%.9f%n", ((BodyTube) k).getOuterRadius());
    }
  }
}
