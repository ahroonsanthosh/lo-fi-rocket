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
 * Black-box probe (D-084): what a mass or CG override on the stage does to
 * the rocket's structure mass, CG and inertias. Saved, reloaded and measured
 * as loaded. Output kept in reference/rockets/stage-override-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/StageOverrideProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar StageOverrideProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.masscalc.MassCalculator;
import info.openrocket.core.masscalc.RigidBody;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;

public final class StageOverrideProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Nose (filled conical balsa, 0.1 x 0.025), body tube 0.5 m paper, 0.03 kg mass at 0.2 m in the tube.
    // Case 0: no override; 1: stage mass 0.3 kg; 2: stage CG 0.25 m; 3: both. Cases 4 to 6: 1 to 3
    // with the override covering the subcomponents.
    for (int c = 0; c <= 6; c++) run(c);
  }

  static void run(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("so" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    MassComponent m = new MassComponent(0.02, 0.01, 0.03); m.setName("Weight");
    bt.addChild(m);
    m.setAxialMethod(AxialMethod.TOP); m.setAxialOffset(0.2);
    int which = c > 3 ? c - 3 : c;
    if (which == 1 || which == 3) { st.setMassOverridden(true); st.setOverrideMass(0.3); }
    if (which == 2 || which == 3) { st.setCGOverridden(true); st.setOverrideCGX(0.25); }
    if (c > 3) { st.setSubcomponentsOverriddenMass(true); st.setSubcomponentsOverriddenCG(true); }
    File f = new File("so" + c + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    RigidBody s = MassCalculator.calculateStructure(config);
    System.out.printf("case %d: structure m=%.9f cg=%.9f Irot=%.9e Ilong=%.9e%n", c, s.getMass(), s.getCM().x,
        s.getRotationalInertia(), s.getLongitudinalInertia());
    for (RocketComponent k : loaded) {
      if (k instanceof AxialStage) {
        System.out.printf("case %d: stage massOverridden=%b cgOverridden=%b subcomponentsMass=%b subcomponentsCG=%b mass=%.9f%n", c,
            k.isMassOverridden(), k.isCGOverridden(), k.isSubcomponentsOverriddenMass(), k.isSubcomponentsOverriddenCG(), k.getMass());
      }
    }
  }
}
