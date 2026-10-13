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
 * Black-box probe (D-077): which motor configuration OpenRocket selects when
 * it opens a file with several, which deployment settings a parachute uses in
 * that configuration, and whether the fin cross-section changes the fin mass.
 * Each case is saved, reloaded and measured as loaded. Output kept in
 * reference/rockets/config-probe/. Run from an empty directory:
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ConfigProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar ConfigProbe
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.masscalc.*;
import info.openrocket.core.material.Material;
import info.openrocket.core.motor.*;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;

public final class ConfigProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    // Cases 0..2: fin cross-section square, rounded, airfoil (fin mass).
    for (int c = 0; c <= 2; c++) fins(c);
    // Case 3: three motor configurations, the second made the default; the parachute opens at apogee
    // by default, at an altitude of 150 m in the second configuration, and never in the third.
    configs();
  }

  static Rocket base(String name, TrapezoidFinSet[] finsOut, BodyTube[] btOut) {
    Rocket r = new Rocket(); r.setName(name);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
    fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    finsOut[0] = fins; btOut[0] = bt;
    return r;
  }

  static Rocket saveAndLoad(Rocket r, String file) throws Exception {
    File f = new File(file);
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    return new GeneralRocketLoader(f).load().getRocket();
  }

  static void fins(int c) throws Exception {
    TrapezoidFinSet[] fo = new TrapezoidFinSet[1]; BodyTube[] bo = new BodyTube[1];
    Rocket r = base("config" + c, fo, bo);
    FinSet.CrossSection[] cs = {FinSet.CrossSection.SQUARE, FinSet.CrossSection.ROUNDED, FinSet.CrossSection.AIRFOIL};
    fo[0].setCrossSection(cs[c]);
    Rocket loaded = saveAndLoad(r, "config" + c + ".ork");
    for (RocketComponent k : loaded) {
      if (k instanceof FinSet) {
        System.out.printf("case %d: crossSection=%s finSetMass=%.9f%n", c, ((FinSet) k).getCrossSection(), k.getMass());
      }
    }
  }

  static void configs() throws Exception {
    TrapezoidFinSet[] fo = new TrapezoidFinSet[1]; BodyTube[] bo = new BodyTube[1];
    Rocket r = base("config3", fo, bo);
    BodyTube bt = bo[0];
    InnerTube mount = new InnerTube(); mount.setLength(0.07); mount.setOuterRadius(0.0095); mount.setThickness(0.0005);
    mount.setMaterial(bulk("paper700", 700));
    bt.addChild(mount);
    mount.setAxialMethod(AxialMethod.BOTTOM); mount.setAxialOffset(0.0);
    mount.setMotorMount(true);
    Parachute p = new Parachute(); p.setName("Chute"); p.setLength(0.05); p.setRadius(0.012); p.setCD(0.8);
    p.setDiameter(0.3); p.setMassOverridden(true); p.setOverrideMass(0.012);
    bt.addChild(p);
    p.setAxialMethod(AxialMethod.TOP); p.setAxialOffset(0.02);
    p.getDeploymentConfigurations().getDefault().setDeployEvent(DeploymentConfiguration.DeployEvent.APOGEE);

    // Configurations without motors: the selection and the per-configuration deployment do not depend on them
    // (a made-up motor is not in OpenRocket's database and is dropped on reload).
    FlightConfigurationId[] ids = new FlightConfigurationId[3];
    for (int i = 0; i < 3; i++) {
      ids[i] = new FlightConfigurationId();
      r.createFlightConfiguration(ids[i]);
      r.getFlightConfiguration(ids[i]).setName("config " + i);
    }
    DeploymentConfiguration alt = new DeploymentConfiguration();
    alt.setDeployEvent(DeploymentConfiguration.DeployEvent.ALTITUDE); alt.setDeployAltitude(150);
    p.getDeploymentConfigurations().set(ids[1], alt);
    DeploymentConfiguration never = new DeploymentConfiguration();
    never.setDeployEvent(DeploymentConfiguration.DeployEvent.NEVER);
    p.getDeploymentConfigurations().set(ids[2], never);
    r.setSelectedConfiguration(ids[1]);

    Rocket loaded = saveAndLoad(r, "config3.ork");
    FlightConfiguration sel = loaded.getSelectedConfiguration();
    System.out.printf("case 3: selected configuration=%s (index %d of %d)%n", sel.getName(),
        loaded.getIds().indexOf(sel.getId()), loaded.getIds().size());
    for (RocketComponent k : loaded) {
      if (k instanceof Parachute) {
        DeploymentConfiguration d = ((Parachute) k).getDeploymentConfigurations().get(sel.getId());
        System.out.printf("case 3: parachute in the selected configuration: event=%s altitude=%.3f delay=%.3f%n",
            d.getDeployEvent(), d.getDeployAltitude(), d.getDeployDelay());
      }
    }
  }
}
