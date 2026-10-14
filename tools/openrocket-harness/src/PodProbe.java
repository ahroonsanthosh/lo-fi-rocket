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
 * Plan 0070 step 3: "PodProbe --positions" places one pod set by each radius and axial method,
 * and a pod whose parts differ in radius, and prints where OpenRocket puts it; "PodProbe --chute
 * <motor dir>" flies pods1 with its parachute in the pods (pods4). Plans 0070 step 4 and 0071:
 * "PodProbe --motors <motor dir>" puts a D12-5 in each pod's tube (pods5 with the core's D12-5
 * too, pods6 without it), and flies pods7 (core only) and pods8 (no pods) the same way, printing
 * the mass properties, the flight and the drag coefficient against Mach thrusting and coasting.
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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import info.openrocket.core.simulation.FlightDataBranch;
import info.openrocket.core.simulation.FlightDataType;
import info.openrocket.core.simulation.FlightEvent;

public final class PodProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  static File motorDir;

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    if (a.length > 1 && a[0].equals("--motors")) {
      motorDir = new File(a[1]);
      motors(5, true, true);
      motors(6, false, true);
      motors(7, true, false);
      noPods = true;
      motors(8, true, false);
      return;
    }
    if (a.length > 1 && a[0].equals("--chute")) {
      motorDir = new File(a[1]);
      run(4, 2, false, true);
      return;
    }
    if (a.length > 0 && a[0].equals("--positions")) {
      positions();
      return;
    }
    motorDir = new File(a[0]);
    run(0, 0, false);
    run(1, 2, false);
    run(2, 2, true);
    run(3, 3, false);
  }

  /**
   * With --positions: one pod set (two pods: conical nose 50 x 12.5 mm, 150 mm tube) on a 0.5 m
   * body tube of radius 25 mm after a 0.1 m nose, saved and reloaded for each radius method with
   * offset 0.01 m (axial: bottom, 0) and each axial method with offset 0.02 m (radius: relative,
   * 0.0375 m). Prints the pod set's and its first part's front x and distance from the axis.
   */
  static void positions() throws Exception {
    info.openrocket.core.rocketcomponent.position.RadiusMethod[] radii = {
      info.openrocket.core.rocketcomponent.position.RadiusMethod.COAXIAL,
      info.openrocket.core.rocketcomponent.position.RadiusMethod.FREE,
      info.openrocket.core.rocketcomponent.position.RadiusMethod.RELATIVE,
      info.openrocket.core.rocketcomponent.position.RadiusMethod.SURFACE,
    };
    for (info.openrocket.core.rocketcomponent.position.RadiusMethod rm : radii) place("radius-" + rm.name().toLowerCase(Locale.US), rm, 0.01, AxialMethod.BOTTOM, 0.0);
    AxialMethod[] axials = { AxialMethod.ABSOLUTE, AxialMethod.TOP, AxialMethod.MIDDLE, AxialMethod.BOTTOM };
    for (AxialMethod am : axials) place("axial-" + am.name().toLowerCase(Locale.US), info.openrocket.core.rocketcomponent.position.RadiusMethod.RELATIVE, 0.0375, am, 0.02);
    mixed();
    Class<?>[] holders = { AxialStage.class, NoseCone.class, Transition.class, BodyTube.class, PodSet.class };
    RocketComponent[] made = { new AxialStage(), new NoseCone(), new Transition(), new BodyTube(), new PodSet() };
    for (int i = 0; i < made.length; i++) {
      System.out.printf("accepts: %s podset=%b%n", holders[i].getSimpleName(), made[i].isCompatible(PodSet.class));
    }
  }

  /**
   * A pod whose parts differ in radius: a conical nose 40 x 15 mm, a conical transition 30 mm from
   * 15 to 10 mm and a tube 100 mm of radius 10 mm, on the 25 mm body, for the surface and relative
   * (0.005 m) radius methods. Prints the pod set's distance from the axis.
   */
  static void mixed() throws Exception {
    info.openrocket.core.rocketcomponent.position.RadiusMethod[] radii = {
      info.openrocket.core.rocketcomponent.position.RadiusMethod.SURFACE,
      info.openrocket.core.rocketcomponent.position.RadiusMethod.RELATIVE,
    };
    for (info.openrocket.core.rocketcomponent.position.RadiusMethod rm : radii) {
      for (int order = 0; order < 2; order++) {
        Rocket r = new Rocket();
        AxialStage st = new AxialStage(); r.addChild(st);
        NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
        nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
        st.addChild(nose);
        BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
        st.addChild(bt);
        PodSet ps = new PodSet(); ps.setName("Pods");
        bt.addChild(ps);
        ps.setInstanceCount(2);
        if (order == 0) {
          NoseCone pn = new NoseCone(Transition.Shape.CONICAL, 0.04, 0.015);
          pn.setFilled(true); pn.setMaterial(bulk("balsa160", 160));
          ps.addChild(pn);
          Transition tr = new Transition(); tr.setLength(0.03); tr.setForeRadius(0.015); tr.setAftRadius(0.010);
          tr.setFilled(true); tr.setMaterial(bulk("balsa160", 160));
          ps.addChild(tr);
          BodyTube pt = new BodyTube(0.10, 0.010, 0.0005); pt.setMaterial(bulk("paper700", 700));
          ps.addChild(pt);
        } else {
          // the same radii, tube first: a tube 100 mm of radius 10 mm then a 40 mm tube of 15 mm
          BodyTube a = new BodyTube(0.10, 0.010, 0.0005); a.setMaterial(bulk("paper700", 700));
          ps.addChild(a);
          BodyTube b = new BodyTube(0.04, 0.015, 0.0005); b.setMaterial(bulk("paper700", 700));
          ps.addChild(b);
        }
        ps.setRadius(rm, 0.005);
        String name = "mixed-" + rm.name().toLowerCase(Locale.US) + "-" + order;
        File file = new File("pods-" + name + ".ork");
        new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
        Rocket loaded = new GeneralRocketLoader(file).load().getRocket();
        for (RocketComponent k : loaded) {
          if (k instanceof PodSet) {
            Coordinate[] abs = k.toAbsolute(Coordinate.NUL);
            System.out.printf("pods-%s: absX0=%.9f absR=%.9f%n", name, abs[0].x, Math.hypot(abs[0].y, abs[0].z));
          }
        }
      }
    }
  }

  static void place(String name, info.openrocket.core.rocketcomponent.position.RadiusMethod rm, double radius, AxialMethod am, double axial) throws Exception {
    Rocket r = new Rocket(); r.setName(name);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.5, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    PodSet ps = new PodSet(); ps.setName("Pods");
    bt.addChild(ps);
    ps.setInstanceCount(2);
    ps.setRadius(rm, radius);
    ps.setAxialMethod(am); ps.setAxialOffset(axial);
    NoseCone pn = new NoseCone(Transition.Shape.CONICAL, 0.05, 0.0125);
    pn.setName("Pod nose"); pn.setFilled(true); pn.setMaterial(bulk("balsa160", 160));
    ps.addChild(pn);
    BodyTube pt = new BodyTube(0.15, 0.0125, 0.0005); pt.setName("Pod tube"); pt.setMaterial(bulk("paper700", 700));
    ps.addChild(pt);
    pt.setAxialMethod(AxialMethod.AFTER); pt.setAxialOffset(0.0);
    File file = new File("pods-" + name + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(file).load().getRocket();
    for (RocketComponent k : loaded) {
      if (k instanceof PodSet || "Pod nose".equals(k.getName())) {
        Coordinate[] abs = k.toAbsolute(Coordinate.NUL);
        System.out.printf("pods-%s: %s absX0=%.9f absR=%.9f instances=%d%n", name, k.getName(), abs[0].x, Math.hypot(abs[0].y, abs[0].z), abs.length);
      }
    }
  }

  static void run(int c, int pods, boolean podFins) throws Exception { run(c, pods, podFins, false); }

  static void run(int c, int pods, boolean podFins, boolean chuteInPods) throws Exception {
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
    if (!chuteInPods) {
      bt.addChild(chute);
      chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.1);
    }
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
      if (chuteInPods) {
        pt.addChild(chute);
        chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.01);
      }
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

  /**
   * Plan 0070 step 4, --motors: pods1 with each pod's tube (inner radius 12 mm) a motor mount holding
   * an Estes D12-5, all igniting at launch: pods5 with the core's D12-5 as well, pods6 with the
   * core's mount empty. Prints the pod tube's instance offsets, the structure, motors and launch
   * mass properties, the flight, and the flight's drag coefficient against Mach while thrusting
   * and while coasting.
   */
  static boolean noPods = false;

  static void motors(int c, boolean core, boolean inPods) throws Exception {
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
    Parachute chute = new Parachute(); chute.setName("Parachute"); chute.setDiameter(0.3);
    chute.setCD(0.8); chute.setMassOverridden(true); chute.setOverrideMass(0.01);
    chute.setLength(0.05); chute.setRadiusAutomatic(false); chute.setRadius(0.02);
    bt.addChild(chute);
    chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.1);
    PodSet ps = new PodSet(); ps.setName("Pods");
    bt.addChild(ps);
    ps.setInstanceCount(2);
    ps.setRadiusOffset(0.0375);
    ps.setAngleOffset(0.0);
    ps.setAxialMethod(AxialMethod.BOTTOM); ps.setAxialOffset(0.0);
    NoseCone pn = new NoseCone(Transition.Shape.CONICAL, 0.05, 0.0125);
    pn.setName("Pod nose"); pn.setFilled(true); pn.setMaterial(bulk("balsa160", 160));
    ps.addChild(pn);
    BodyTube pt = new BodyTube(0.15, 0.0125, 0.0005); pt.setName("Pod tube"); pt.setMaterial(bulk("paper700", 700));
    ps.addChild(pt);
    pt.setAxialMethod(AxialMethod.AFTER); pt.setAxialOffset(0.0);
    FlightConfigurationId id = new FlightConfigurationId("5c1a2b3c-4d5e-4f60-8a7b-0000000000b" + c);
    Motor motor = ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12");
    if (core) {
      mt.setMotorMount(true);
      MotorConfiguration mc = new MotorConfiguration(mt, id);
      mc.setMotor(motor); mc.setEjectionDelay(5.0);
      mt.setMotorConfig(mc, id);
    }
    if (inPods) {
      pt.setMotorMount(true);
      MotorConfiguration pc = new MotorConfiguration(pt, id);
      pc.setMotor(motor); pc.setEjectionDelay(5.0);
      pt.setMotorConfig(pc, id);
    }
    r.createFlightConfiguration(id);
    r.setSelectedConfiguration(id);
    if (noPods) bt.removeChild(ps);
    File file = new File(name + ".ork");
    new GeneralRocketSaver().save(file, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    OpenRocketDocument loadedDoc = new GeneralRocketLoader(file).load();
    Rocket loaded = loadedDoc.getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    for (RocketComponent k : loaded) {
      if ("Pod tube".equals(k.getName())) {
        StringBuilder sb = new StringBuilder();
        for (Coordinate p : k.toAbsolute(Coordinate.NUL)) sb.append(String.format(Locale.US, " (%.9f, %.9f, %.9f)", p.x, p.y, p.z));
        System.out.printf("%s: pod tube at [%s ]%n", name, sb);
      }
    }
    RigidBody structure = MassCalculator.calculateStructure(config);
    RigidBody motors = MassCalculator.calculateMotor(config);
    RigidBody launch = MassCalculator.calculateLaunch(config);
    System.out.printf("%s: structure m=%.9f cg=%.9f Ixx=%.9e Iyy=%.9e Izz=%.9e%n", name, structure.getMass(), structure.getCM().x, structure.getIxx(), structure.getIyy(), structure.getIzz());
    System.out.printf("%s: motors m=%.9f cg=%.9f Ixx=%.9e Iyy=%.9e Izz=%.9e%n", name, motors.getMass(), motors.getCM().x, motors.getIxx(), motors.getIyy(), motors.getIzz());
    System.out.printf("%s: launch m=%.9f cg=%.9f%n", name, launch.getMass(), launch.getCM().x);
    Simulation sim = new Simulation(loadedDoc, loaded);
    sim.setFlightConfigurationId(config.getFlightConfigurationID());
    ReferenceHarness.configure(sim.getOptions(), 0.0);
    sim.simulate();
    FlightData d = sim.getSimulatedData();
    System.out.printf("%s: apogee %.3f m, max v %.3f m/s, rail exit %.3f m/s, t_apogee %.3f s, ground hit %.3f m/s%n", name,
        d.getMaxAltitude(), d.getMaxVelocity(), d.getLaunchRodVelocity(), d.getTimeToApogee(), d.getGroundHitVelocity());
    FlightDataBranch b = d.getBranch(0);
    List<Double> t = b.get(FlightDataType.TYPE_TIME);
    List<Double> mach = b.get(FlightDataType.TYPE_MACH_NUMBER);
    List<Double> cd = b.get(FlightDataType.TYPE_DRAG_COEFF);
    double burnout = Double.NaN, apogee = Double.NaN;
    for (FlightEvent e : b.getEvents()) {
      if (e.getType() == FlightEvent.Type.BURNOUT && Double.isNaN(burnout)) burnout = e.getTime();
      if (e.getType() == FlightEvent.Type.APOGEE) apogee = e.getTime();
    }
    System.out.printf("%s: burnout %.4f s, apogee %.4f s%n", name, burnout, apogee);
    double[] at = { 0.10, 0.12, 0.14, 0.16, 0.18 };
    for (double m : at) {
      FlightConditions fc = new FlightConditions(config);
      fc.setMach(m); fc.setAOA(0); fc.setRollRate(0);
      AerodynamicForces f = new BarrowmanCalculator().getAerodynamicForces(config, fc, new WarningSet());
      System.out.printf("%s: Mach %.2f cd thrusting=%s coasting=%s static=%.5f (friction %.5f pressure %.5f base %.5f)%n", name, m, cdAt(t, mach, cd, m, 0.05, burnout - 0.05), cdAt(t, mach, cd, m, burnout + 0.05, apogee), f.getCD(), f.getFrictionCD(), f.getPressureCD(), f.getBaseCD());
    }
  }

  /** The drag coefficient at Mach m, interpolated between samples with time in [t0, t1], or "-". */
  static String cdAt(List<Double> t, List<Double> mach, List<Double> cd, double m, double t0, double t1) {
    for (int i = 0; i + 1 < t.size(); i++) {
      double ta = t.get(i), tb = t.get(i + 1);
      if (ta < t0 || tb > t1) continue;
      double a = mach.get(i), bm = mach.get(i + 1);
      if ((a - m) * (bm - m) <= 0 && a != bm) {
        double f = (m - a) / (bm - a);
        return String.format(Locale.US, "%.5f", cd.get(i) + f * (cd.get(i + 1) - cd.get(i)));
      }
    }
    return "-";
  }
}
