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
 * Black-box probe for decision D-073: how OpenRocket applies component mass
 * and CG overrides. Prints OpenRocket's structure mass, CG and inertias for
 * eleven override cases and saves each rocket as probe<N>.ork. Output kept in
 * reference/rockets/override-probe/. Run from an empty directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/OverrideProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar OverrideProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.masscalc.*;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;

public final class OverrideProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    for (int c = 0; c <= 10; c++) run(c);
  }
  static void run(int c) throws Exception {
    Rocket r = new Rocket(); r.setName("probe" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    MassComponent mc = new MassComponent(0.02, 0.02, 0.03);
    mc.setAxialMethod(AxialMethod.TOP); mc.setAxialOffset(0.1);
    bt.addChild(mc);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08); fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    RailButton rb = new RailButton(0.01, 0.006, 0.01, 0.002, 0.002); rb.setMaterial(bulk("nylon1150", 1150)); rb.setInstanceCount(2); rb.setInstanceSeparation(0.2);
    if (c >= 9) { bt.addChild(fins); bt.addChild(rb); }
    if (c == 10) { fins.setMassOverridden(true); fins.setOverrideMass(0.06); fins.setCGOverridden(true); fins.setOverrideCGX(0.02); rb.setMassOverridden(true); rb.setOverrideMass(0.004); }
    MassComponent nm = null;
    if (c == 7 || c == 8) { nm = new MassComponent(0.02, 0.01, 0.04); nm.setAxialMethod(AxialMethod.TOP); nm.setAxialOffset(0.02); nose.addChild(nm); }
    switch (c) {
      case 1: nose.setMassOverridden(true); nose.setOverrideMass(0.05); break;
      case 2: nose.setCGOverridden(true); nose.setOverrideCGX(0.03); break;
      case 3: nose.setMassOverridden(true); nose.setOverrideMass(0.05); nose.setCGOverridden(true); nose.setOverrideCGX(0.03); break;
      case 4: bt.setMassOverridden(true); bt.setOverrideMass(0.2); break;
      case 5: bt.setMassOverridden(true); bt.setOverrideMass(0.2); bt.setSubcomponentsOverriddenMass(true); break;
      case 6: bt.setCGOverridden(true); bt.setOverrideCGX(0.4); bt.setSubcomponentsOverriddenCG(true); break;
      case 7: nose.setMassOverridden(true); nose.setOverrideMass(0.05); nose.setSubcomponentsOverriddenMass(true); break;
      case 8: nose.setMassOverridden(true); nose.setOverrideMass(0.05); nose.setCGOverridden(true); nose.setOverrideCGX(0.03); nose.setSubcomponentsOverridden(true); break;
    }
    FlightConfigurationId fcid = new FlightConfigurationId();
    r.createFlightConfiguration(fcid);
    r.setSelectedConfiguration(fcid);
    FlightConfiguration cfg = r.getFlightConfiguration(fcid);
    cfg.setAllStages();
    RigidBody s = MassCalculator.calculateStructure(cfg);
    System.out.printf("case %d: structure m=%.9f cg=%.9f Irot=%.9e Ilong=%.9e%n", c, s.getMass(), s.getCM().x, s.getRotationalInertia(), s.getLongitudinalInertia());
    for (RocketComponent k : new RocketComponent[]{nose, bt, mc, nm, c >= 9 ? fins : null, c >= 9 ? rb : null}) {
      if (k == null) continue;
      System.out.printf("   x0=%.9f n=%d %s cgOver=%.9f mass=%.9f compMass=%.9f cgRel=%.9f Irot_unit=%.9e Ilong_unit=%.9e%n", k.getComponentLocations()[0].x, k.getInstanceCount(), k.getClass().getSimpleName(), k.getCG().x, k.getMass(), k.getComponentMass(), k.getComponentCG().x, k.getRotationalUnitInertia(), k.getLongitudinalUnitInertia());
    }
    OpenRocketDocument doc = OpenRocketDocumentFactory.createDocumentFromRocket(r);
    new GeneralRocketSaver().save(new File("probe" + c + ".ork"), doc);
  }
}
