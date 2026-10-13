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
 * Black-box probe (D-084): the mass and CG OpenRocket gives a transition with
 * fore and aft shoulders, open and capped, and without shoulders. Saved,
 * reloaded and measured as loaded. Output kept in
 * reference/rockets/transition-shoulder-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/TransitionShoulderProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar TransitionShoulderProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;

public final class TransitionShoulderProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Conical transition 0.05 m long, radii 0.031 to 0.02 m, 1 mm paper (700 kg/m³).
    // Case 0: no shoulders; 1: fore shoulder (r 0.029, l 0.03, t 0.001) open; 2: the same capped;
    // 3: aft shoulder (r 0.018, l 0.02, t 0.001) capped; 4: both, capped.
    for (int c = 0; c <= 4; c++) run(c);
  }

  static void run(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("ts" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.031);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.3, 0.031, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    Transition tr = new Transition(); tr.setName("Transition");
    tr.setShapeType(Transition.Shape.CONICAL);
    tr.setLength(0.05); tr.setForeRadius(0.031); tr.setAftRadius(0.02);
    tr.setThickness(0.001); tr.setMaterial(bulk("paper700", 700));
    if (c == 1 || c == 2 || c == 4) {
      tr.setForeShoulderRadius(0.029); tr.setForeShoulderLength(0.03); tr.setForeShoulderThickness(0.001);
      tr.setForeShoulderCapped(c != 1);
    }
    if (c == 3 || c == 4) {
      tr.setAftShoulderRadius(0.018); tr.setAftShoulderLength(0.02); tr.setAftShoulderThickness(0.001);
      tr.setAftShoulderCapped(true);
    }
    st.addChild(tr);
    tr.setAxialMethod(AxialMethod.AFTER); tr.setAxialOffset(0.0);
    File f = new File("ts" + c + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof Transition && !(k instanceof NoseCone)) {
        System.out.printf("case %d: transition absX0=%.9f mass=%.9f cgRel=%.9f Irot_unit=%.9e Ilong_unit=%.9e%n", c,
            k.toAbsolute(info.openrocket.core.util.Coordinate.NUL)[0].x, k.getMass(), k.getCG().x,
            k.getRotationalUnitInertia(), k.getLongitudinalUnitInertia());
      }
    }
  }
}
