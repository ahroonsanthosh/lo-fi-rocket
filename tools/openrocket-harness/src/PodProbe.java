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
 * Black-box probe (plan 0070): pod sets. The same R1-like rocket alone
 * (pods0), with two plain pods (pods1: conical nose and tube), two pods
 * with three fins each (pods2), and three plain pods (pods3), each pod
 * beside the body tube's aft end. Saved, reloaded and measured as loaded:
 * every component's mass, CG, CP and C_Na at Mach 0.3, and the rocket's
 * worst CP, C_Na, structure mass, CG and inertias; the drag coefficient and
 * its friction, pressure and base parts at Mach 0.3; and a flight on an Estes
 * D12-5 in R1's motor tube with a 0.3 m parachute at apogee, with the
 * reference harness's settings and no wind.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ReferenceHarness.java src/PodProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar PodProbe <motor dir>
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.document.*;
import info.openrocket.core.motor.Motor;
import info.openrocket.core.motor.MotorConfiguration;
import info.openrocket.core.simulation.FlightData;
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

public final class PodProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  static File motorDir;

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    motorDir = new File(a[0]);
    run(0, 0, false);
    run(1, 2, false);
    run(2, 2, true);
    run(3, 3, false);
  }

  static void run(int c, int pods, boolean podFins) throws Exception {
    String name = "pods" + c;
    Rocket r = new Rocket(); r.setName(name);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
    fins.setName("Fins"); fins.setThickness(0.003); fins.setMaterial(bulk("ply600", 600));
    fins.setCrossSection(FinSet.CrossSection.SQUARE);
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    InnerTube mt = new InnerTube(); mt.setName("Motor tube"); mt.setLength(0.075);
    mt.setOuterRadius(0.0125); mt.setThickness(0.0005); mt.setMaterial(bulk("paper700", 700));
    bt.addChild(mt);
    mt.setAxialMethod(AxialMethod.BOTTOM); mt.setAxialOffset(0.0);
    mt.setMotorMount(true);
    Parachute chute = new Parachute(); chute.setName("Parachute"); chute.setDiameter(0.3);
    chute.setCD(0.8); chute.setMassOverridden(true); chute.setOverrideMass(0.01);
    chute.setLength(0.05); chute.setRadiusAutomatic(false); chute.setRadius(0.02);
    bt.addChild(chute);
    chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.1);
    FlightConfigurationId id = new FlightConfigurationId("5c1a2b3c-4d5e-4f60-8a7b-0000000000a" + c);
    Motor motor = ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12");
    MotorConfiguration mc = new MotorConfiguration(mt, id);
    mc.setMotor(motor); mc.setEjectionDelay(5.0);
    mt.setMotorConfig(mc, id);
    r.createFlightConfiguration(id);
    r.setSelectedConfiguration(id);
    if (pods > 0) {
      PodSet ps = new PodSet(); ps.setName("Pods");
      bt.addChild(ps);
      ps.setInstanceCount(pods);
      ps.setRadiusOffset(0.0375);
      ps.setAngleOffset(0.0);
      ps.setAxialMethod(AxialMethod.BOTTOM); ps.setAxialOffset(0.0);
      NoseCone pn = new NoseCone(Transition.Shape.CONICAL, 0.05, 0.0125);
      pn.setName("Pod nose"); pn.setFilled(true); pn.setMaterial(bulk("balsa160", 160));
      ps.addChild(pn);
      BodyTube pt = new BodyTube(0.15, 0.0125, 0.0005); pt.setName("Pod tube"); pt.setMaterial(bulk("paper700", 700));
      ps.addChild(pt);
      pt.setAxialMethod(AxialMethod.AFTER); pt.setAxialOffset(0.0);
      if (podFins) {
        TrapezoidFinSet pf = new TrapezoidFinSet(3, 0.05, 0.03, 0.02, 0.03);
        pf.setName("Pod fins"); pf.setThickness(0.002); pf.setMaterial(bulk("ply600", 600));
        pf.setCrossSection(FinSet.CrossSection.SQUARE);
        pt.addChild(pf);
        pf.setAxialMethod(AxialMethod.BOTTOM); pf.setAxialOffset(0.0);
      }
    }
    File file = new File(name + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    OpenRocketDocument loadedDoc = new GeneralRocketLoader(file).load();
    Rocket loaded = loadedDoc.getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    FlightConditions fc = new FlightConditions(config);
    fc.setMach(0.3); fc.setAOA(0); fc.setRollRate(0);
    BarrowmanCalculator aero = new BarrowmanCalculator();
    Map<RocketComponent, AerodynamicForces> forces = aero.getForceAnalysis(config, fc, new WarningSet());
    for (RocketComponent k : loaded) {
      if (k instanceof Rocket || k instanceof AxialStage) continue;
      AerodynamicForces f = forces.get(k);
      Coordinate[] abs = k.toAbsolute(Coordinate.NUL);
      System.out.printf("%s: %s \"%s\" instances=%d absX0=%.9f absR=%.6f mass=%.9f cgAbs=%.9f cp=%s cna=%s%n", name,
          k.getClass().getSimpleName(), k.getName(), abs.length, abs[0].x, Math.hypot(abs[0].y, abs[0].z), k.getMass(),
          k.toAbsolute(k.getCG())[0].x,
          f == null ? "-" : String.format(Locale.US, "%.9f", f.getCP().x),
          f == null ? "-" : String.format(Locale.US, "%.9f", f.getCP().weight));
    }
    Coordinate cp = aero.getWorstCP(config, fc, new WarningSet());
    RigidBody s = MassCalculator.calculateStructure(config);
    System.out.printf("%s: rocket worst CP x=%.9f CNa=%.9f structure m=%.9f cg=%.9f Ixx=%.9e Iyy=%.9e Izz=%.9e length=%.6f%n", name, cp.x, cp.weight, s.getMass(), s.getCM().x, s.getIxx(), s.getIyy(), s.getIzz(), loaded.getLength());
    AerodynamicForces total = aero.getAerodynamicForces(config, fc, new WarningSet());
    System.out.printf("%s: Mach 0.3 CD=%.6f friction=%.6f pressure=%.6f base=%.6f%n", name,
        total.getCD(), total.getFrictionCD(), total.getPressureCD(), total.getBaseCD());
    Simulation sim = new Simulation(loadedDoc, loaded);
    sim.setFlightConfigurationId(config.getFlightConfigurationID());
    ReferenceHarness.configure(sim.getOptions(), 0.0);
    sim.simulate();
    FlightData d = sim.getSimulatedData();
    System.out.printf("%s: apogee %.3f m, max v %.3f m/s, rail exit %.3f m/s, t_apogee %.3f s, ground hit %.3f m/s%n", name,
        d.getMaxAltitude(), d.getMaxVelocity(), d.getLaunchRodVelocity(), d.getTimeToApogee(), d.getGroundHitVelocity());
  }
}
