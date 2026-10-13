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
 * Black-box probe (plan 0057): OpenRocket's motor cluster layouts, and a
 * rocket with a three-motor cluster of Estes D12s (mass, CG and inertias of
 * the structure and the motors, and a flight with the reference harness's
 * settings, no wind). Saved, reloaded and measured as loaded. Output kept in
 * reference/rockets/cluster-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ReferenceHarness.java src/ClusterProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar ClusterProbe <motor dir>
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.masscalc.MassCalculator;
import info.openrocket.core.masscalc.RigidBody;
import info.openrocket.core.material.Material;
import info.openrocket.core.motor.Motor;
import info.openrocket.core.motor.MotorConfiguration;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.simulation.FlightData;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import java.io.*;
import java.util.Locale;

public final class ClusterProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    for (ClusterConfiguration c : ClusterConfiguration.CONFIGURATIONS) {
      System.out.printf("layout %s count=%d points=%s%n", c.getXMLName(), c.getClusterCount(), c.getPoints());
    }
    File motorDir = new File(a[0]);
    // Case 0: one D12 (single); case 1: three D12s, layout "3-ring", scale 1, rotation 0;
    // case 2: case 1 with the cluster rotated 30 degrees and scale 1.2; case 3: case 1 with a
    // 0.03 kg mass override on the motor tubes.
    for (int c = 0; c <= 3; c++) run(c, motorDir);
  }

  static void run(int c, File motorDir) throws Exception {
    Rocket r = new Rocket(); r.setName("cluster" + c);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.16, 0.04);
    nose.setThickness(0.002); nose.setMaterial(bulk("Reference plastic 1050", 1050));
    st.addChild(nose);
    BodyTube bt = new BodyTube(0.6, 0.04, 0.0012); bt.setName("Body tube");
    bt.setMaterial(bulk("Reference paper 700", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    TrapezoidFinSet fins = new TrapezoidFinSet(4, 0.12, 0.06, 0.06, 0.08); fins.setName("Fins");
    fins.setThickness(0.003); fins.setMaterial(bulk("Reference plywood 600", 600));
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    InnerTube mt = new InnerTube(); mt.setName("Motor tubes");
    mt.setLength(0.08); mt.setOuterRadius(0.0125); mt.setThickness(0.0005);
    mt.setMaterial(bulk("Reference paper 700", 700));
    bt.addChild(mt);
    mt.setAxialMethod(AxialMethod.BOTTOM); mt.setAxialOffset(0.0);
    if (c >= 1) {
      for (ClusterConfiguration k : ClusterConfiguration.CONFIGURATIONS)
        if (k.getXMLName().equals("3-ring")) mt.setClusterConfiguration(k);
    }
    if (c == 2) { mt.setClusterRotation(Math.toRadians(30)); mt.setClusterScale(1.2); }
    if (c == 3) { mt.setMassOverridden(true); mt.setOverrideMass(0.03); }
    mt.setMotorMount(true);
    Parachute chute = new Parachute(); chute.setName("Parachute"); chute.setDiameter(0.6);
    chute.setCD(0.8); chute.setMassOverridden(true); chute.setOverrideMass(0.03);
    chute.setLength(0.05); chute.setRadiusAutomatic(false); chute.setRadius(0.02);
    bt.addChild(chute);
    chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.05);
    String fcid = "probe";
    FlightConfigurationId id = new FlightConfigurationId("2bb6b7d4-7a3a-4d55-9c0f-6e0b1c2d3e4f");
    Motor motor = ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12");
    MotorConfiguration mc = new MotorConfiguration(mt, id);
    mc.setMotor(motor); mc.setEjectionDelay(5.0);
    mt.setMotorConfig(mc, id);
    r.createFlightConfiguration(id);
    r.setSelectedConfiguration(id);
    File f = new File("cluster" + c + ".ork");
    OpenRocketDocument doc = OpenRocketDocumentFactory.createDocumentFromRocket(r);
    new GeneralRocketSaver().save(f, doc);
    OpenRocketDocument loadedDoc = new GeneralRocketLoader(f).load();
    Rocket loaded = loadedDoc.getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    for (RocketComponent k : loaded) {
      if (k instanceof InnerTube) {
        StringBuilder s = new StringBuilder();
        for (Coordinate p : k.getInstanceOffsets()) s.append(String.format(Locale.US, " (%.9f, %.9f, %.9f)", p.x, p.y, p.z));
        System.out.printf("case %d: tubes instances=%d offsets=[%s ] mass=%.9f%n", c, ((InnerTube) k).getInstanceCount(), s, k.getMass());
      }
    }
    RigidBody structure = MassCalculator.calculateStructure(config);
    RigidBody motors = MassCalculator.calculateMotor(config);
    RigidBody launch = MassCalculator.calculateLaunch(config);
    System.out.printf("case %d: structure m=%.9f cg=%.9f Ixx=%.9e Iyy=%.9e Izz=%.9e%n", c, structure.getMass(), structure.getCM().x, structure.getIxx(), structure.getIyy(), structure.getIzz());
    System.out.printf("case %d: motors m=%.9f cg=%.9f Ixx=%.9e Iyy=%.9e Izz=%.9e%n", c, motors.getMass(), motors.getCM().x, motors.getIxx(), motors.getIyy(), motors.getIzz());
    System.out.printf("case %d: launch m=%.9f cg=%.9f%n", c, launch.getMass(), launch.getCM().x);
    Simulation sim = new Simulation(loadedDoc, loaded);
    sim.setFlightConfigurationId(config.getFlightConfigurationID());
    ReferenceHarness.configure(sim.getOptions(), 0.0);
    sim.simulate();
    FlightData d = sim.getSimulatedData();
    System.out.printf("case %d: apogee %.3f m, max v %.3f m/s, rail exit %.3f m/s, t_apogee %.3f s, ground hit %.3f m/s%n", c,
        d.getMaxAltitude(), d.getMaxVelocity(), d.getLaunchRodVelocity(), d.getTimeToApogee(), d.getGroundHitVelocity());
  }
}
