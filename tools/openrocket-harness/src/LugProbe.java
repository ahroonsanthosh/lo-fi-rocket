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
 * Black-box probe (D-084): what OpenRocket does with a launch lug of several
 * instances (mass, CG, instance positions, drag against one lug, with and
 * without mass and CG overrides) and with a rail button screw height (mass,
 * CG, drag). Saved, reloaded and measured as
 * loaded. Output kept in reference/rockets/lug-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/LugProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar LugProbe
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

public final class LugProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Cases 0..2: lug instances 1, 1 (second lug as its own component), 3; cases 3..4: rail button
    // screw height 0 and 0.003 m; case 5: case 2 with a 0.01 kg mass override and a 0.02 m CG
    // override.
    for (int c = 0; c <= 5; c++) run(c);
  }

  static void run(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("lug" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    if (c <= 2 || c == 5) {
      LaunchLug lug = new LaunchLug(); lug.setName("Lug");
      lug.setLength(0.03); lug.setOuterRadius(0.003); lug.setThickness(0.0005);
      lug.setMaterial(bulk("paper700", 700));
      bt.addChild(lug);
      lug.setAxialMethod(AxialMethod.TOP); lug.setAxialOffset(0.2);
      if (c == 2 || c == 5) { lug.setInstanceCount(3); lug.setInstanceSeparation(0.05); }
      if (c == 5) {
        lug.setMassOverridden(true); lug.setOverrideMass(0.01);
        lug.setCGOverridden(true); lug.setOverrideCGX(0.02);
      }
      if (c == 1) {
        LaunchLug lug2 = new LaunchLug(); lug2.setName("Lug2");
        lug2.setLength(0.03); lug2.setOuterRadius(0.003); lug2.setThickness(0.0005);
        lug2.setMaterial(bulk("paper700", 700));
        bt.addChild(lug2);
        lug2.setAxialMethod(AxialMethod.TOP); lug2.setAxialOffset(0.25);
      }
    } else {
      RailButton rb = new RailButton(); rb.setName("Buttons");
      rb.setMaterial(bulk("delrin1420", 1420));
      bt.addChild(rb);
      rb.setInstanceCount(2); rb.setInstanceSeparation(0.2);
      rb.setAxialMethod(AxialMethod.TOP); rb.setAxialOffset(0.1);
      if (c == 4) rb.setScrewHeight(0.003);
    }
    File f = new File("lug" + c + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    FlightConditions fc = new FlightConditions(config);
    fc.setMach(0.3); fc.setAOA(0.0); fc.setRollRate(0.0);
    BarrowmanCalculator aero = new BarrowmanCalculator();
    Map<RocketComponent, AerodynamicForces> forces = aero.getForceAnalysis(config, fc, new WarningSet());
    for (RocketComponent k : loaded) {
      if (k instanceof LaunchLug || k instanceof RailButton) {
        StringBuilder locs = new StringBuilder();
        for (Coordinate p : k.getComponentLocations()) locs.append(String.format(Locale.US, " %.6f", p.x));
        AerodynamicForces af = forces.get(k);
        System.out.printf("case %d: %s instances=%d locations=[%s ] mass=%.9f cgAbs=%.9f cd=%.9e pressureCD=%.9e frictionCD=%.9e%n",
            c, k.getName(), ((Instanceable) k).getInstanceCount(), locs, k.getMass(), k.toAbsolute(k.getCG())[0].x,
            af == null ? Double.NaN : af.getCD(), af == null ? Double.NaN : af.getPressureCD(), af == null ? Double.NaN : af.getFrictionCD());
      }
    }
    AerodynamicForces total = aero.getAerodynamicForces(config, fc, new WarningSet());
    System.out.printf("case %d: total cd=%.9e pressureCD=%.9e frictionCD=%.9e baseCD=%.9e%n", c,
        total.getCD(), total.getPressureCD(), total.getFrictionCD(), total.getBaseCD());
    RigidBody structure = MassCalculator.calculateStructure(config);
    System.out.printf("case %d: rocket structure mass=%.9f cg=%.9f%n", c, structure.getMass(), structure.getCM().x);
  }
}
