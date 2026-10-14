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
 * Black-box probe (plan 0064): OpenRocket's staged examples as it opens them. For each file:
 * the stages with their separation event and delay, the motor mounts with their stage, motor,
 * ignition event, ignition delay and ejection delay, then a flight with the reference harness's
 * settings and no wind: the events of every branch with their times, the sustainer's apogee and
 * maximum velocity, and its mass and CG just before and after each separation. With "--build
 * <motor dir> <out dir>" it first builds two staged rockets of our own from the reference motors,
 * saves them and probes them as loaded:
 *   staged-bp: Estes D12-0 booster (automatic ignition: launch), C6-5 sustainer (automatic: the
 *     booster's ejection charge), booster separating at the upper stage's ignition;
 *   staged-hpr: AeroTech H128W booster, G80T sustainer lit 0.5 s after the booster's burnout,
 *     booster separating at its own burnout.
 * Output kept in reference/rockets/staging-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ReferenceHarness.java src/StagingProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar StagingProbe <file.ork> ...
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar StagingProbe --build <motors> <out>
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar StagingProbe --gaps <motors> <out>
 * "--gaps" builds and probes two three-stage rockets with a stage that has no motor (see gap()).
 * "--events" prints the file's words for every ignition and separation event (see events()).
 * "--inactive" probes a stage switched off in the configuration (see inactive()).
 * "--override" probes staged-bp with a mass and CG override on its booster stage.
 */
import info.openrocket.core.document.*;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.material.Material;
import info.openrocket.core.motor.IgnitionEvent;
import info.openrocket.core.motor.Motor;
import info.openrocket.core.motor.MotorConfiguration;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.simulation.FlightData;
import info.openrocket.core.simulation.FlightDataBranch;
import info.openrocket.core.simulation.FlightDataType;
import info.openrocket.core.simulation.FlightEvent;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.File;
import java.util.List;
import java.util.Locale;

public final class StagingProbe {
  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    if (a.length == 3 && a[0].equals("--build")) {
      File motors = new File(a[1]);
      File out = new File(a[2]);
      out.mkdirs();
      probe(build("staged-bp", motors, out));
      probe(build("staged-hpr", motors, out));
      return;
    }
    if (a.length == 3 && a[0].equals("--events")) {
      events(new File(a[1]), new File(a[2]));
      return;
    }
    if (a.length == 3 && a[0].equals("--inactive")) {
      File motors = new File(a[1]);
      File out = new File(a[2]);
      out.mkdirs();
      probe(inactive("staged-off-booster", motors, out));
      probe(inactive("staged-off-middle", motors, out));
      return;
    }
    if (a.length == 3 && a[0].equals("--override")) {
      File motors = new File(a[1]);
      File out = new File(a[2]);
      out.mkdirs();
      File f = build("staged-bp", motors, out);
      OpenRocketDocument doc = new GeneralRocketLoader(f).load();
      AxialStage booster = (AxialStage) doc.getRocket().getChild(1);
      // The booster's own override, covering its parts' mass and CG: 70 g with its CG 50 mm from
      // the stage's front (or from the nose tip, if that is how OpenRocket reads it).
      booster.setMassOverridden(true); booster.setOverrideMass(0.07);
      booster.setCGOverridden(true); booster.setOverrideCGX(0.05);
      booster.setSubcomponentsOverridden(true);
      File o = new File(out, "staged-override.ork");
      new GeneralRocketSaver().save(o, doc);
      probe(o);
      return;
    }
    if (a.length == 3 && a[0].equals("--gaps")) {
      File motors = new File(a[1]);
      File out = new File(a[2]);
      out.mkdirs();
      probe(gap("staged-gap-bottom", motors, out));
      probe(gap("staged-gap-middle", motors, out));
      return;
    }
    for (String path : a) probe(new File(path));
  }

  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  /** One stage's airframe: body tube, fins, motor tube; nose cone on the top stage only. */
  static InnerTube stage(AxialStage st, boolean top, double radius, double bodyLength, double motorRadius, double motorLength) {
    if (top) {
      NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 4 * radius, radius);
      nose.setThickness(0.002); nose.setMaterial(bulk("Reference plastic 1050", 1050));
      st.addChild(nose);
    }
    BodyTube bt = new BodyTube(bodyLength, radius, 0.001); bt.setName(top ? "Sustainer body" : "Booster body");
    bt.setMaterial(bulk("Reference paper 700", 700));
    st.addChild(bt);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 3 * radius, 1.5 * radius, 1.5 * radius, 2.2 * radius);
    fins.setName(top ? "Sustainer fins" : "Booster fins");
    fins.setThickness(0.003); fins.setMaterial(bulk("Reference plywood 600", 600));
    bt.addChild(fins);
    fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    InnerTube mt = new InnerTube(); mt.setName(top ? "Sustainer motor tube" : "Booster motor tube");
    mt.setLength(motorLength); mt.setOuterRadius(motorRadius + 0.0005); mt.setThickness(0.0005);
    mt.setMaterial(bulk("Reference paper 700", 700));
    bt.addChild(mt);
    mt.setAxialMethod(AxialMethod.BOTTOM); mt.setAxialOffset(0.0);
    mt.setMotorMount(true);
    if (top) {
      Parachute chute = new Parachute(); chute.setName("Parachute"); chute.setDiameter(10 * radius);
      chute.setCD(0.8); chute.setMassOverridden(true); chute.setOverrideMass(0.02);
      chute.setLength(0.05); chute.setRadiusAutomatic(false); chute.setRadius(radius * 0.8);
      bt.addChild(chute);
      chute.setAxialMethod(AxialMethod.TOP); chute.setAxialOffset(0.05);
      chute.getDeploymentConfigurations().getDefault().setDeployEvent(DeploymentConfiguration.DeployEvent.APOGEE);
    }
    return mt;
  }

  static File build(String name, File motorDir, File outDir) throws Exception {
    boolean bp = name.equals("staged-bp");
    Rocket r = new Rocket(); r.setName(name);
    AxialStage sustainer = new AxialStage(); sustainer.setName("Sustainer"); r.addChild(sustainer);
    AxialStage booster = new AxialStage(); booster.setName("Booster"); r.addChild(booster);
    double radius = bp ? 0.0165 : 0.0275;
    InnerTube top = stage(sustainer, true, radius, bp ? 0.35 : 0.6, bp ? 0.009 : 0.0145, bp ? 0.075 : 0.13);
    InnerTube low = stage(booster, false, radius, bp ? 0.12 : 0.25, bp ? 0.012 : 0.0145, bp ? 0.075 : 0.2);
    StageSeparationConfiguration sep = booster.getSeparationConfigurations().getDefault();
    sep.setSeparationEvent(bp ? StageSeparationConfiguration.SeparationEvent.UPPER_IGNITION : StageSeparationConfiguration.SeparationEvent.BURNOUT);
    sep.setSeparationDelay(0.0);
    FlightConfigurationId id = new FlightConfigurationId(bp ? "6a0f1c1e-1b2d-4c1a-9f00-0000000000b1" : "6a0f1c1e-1b2d-4c1a-9f00-0000000000b2");
    Motor upper = bp ? ReferenceHarness.loadMotor(motorDir, "Estes_C6.eng", "C6") : ReferenceHarness.loadMotor(motorDir, "AeroTech_G80T.eng", "G80NBT");
    Motor lower = bp ? ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12") : ReferenceHarness.loadMotor(motorDir, "AeroTech_H128W.eng", "H128W");
    MotorConfiguration up = new MotorConfiguration(top, id);
    up.setMotor(upper); up.setEjectionDelay(bp ? 5.0 : 7.0);
    if (bp) { up.setIgnitionEvent(IgnitionEvent.AUTOMATIC); up.setIgnitionDelay(0.0); }
    else { up.setIgnitionEvent(IgnitionEvent.BURNOUT); up.setIgnitionDelay(0.5); }
    top.setMotorConfig(up, id);
    MotorConfiguration lo = new MotorConfiguration(low, id);
    lo.setMotor(lower); lo.setEjectionDelay(bp ? 0.0 : 14.0);
    lo.setIgnitionEvent(IgnitionEvent.AUTOMATIC); lo.setIgnitionDelay(0.0);
    low.setMotorConfig(lo, id);
    r.createFlightConfiguration(id);
    r.setSelectedConfiguration(id);
    File f = new File(outDir, name + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    return f;
  }

  /**
   * Three stages, every ignition automatic, one stage without a motor: "staged-gap-bottom" has no
   * motor in the bottom stage (D12-0 in the middle, C6-5 on top), "staged-gap-middle" none in the
   * middle stage (D12-0 at the bottom, C6-5 on top). Every stage separates at the upper stage's
   * ignition. Settles which stage "automatic" lights at launch and whose charge lights the next.
   */
  static File gap(String name, File motorDir, File outDir) throws Exception {
    boolean bottom = name.equals("staged-gap-bottom");
    Rocket r = new Rocket(); r.setName(name);
    AxialStage s0 = new AxialStage(); s0.setName("Sustainer"); r.addChild(s0);
    AxialStage s1 = new AxialStage(); s1.setName("Middle"); r.addChild(s1);
    AxialStage s2 = new AxialStage(); s2.setName("Bottom"); r.addChild(s2);
    double radius = 0.0165;
    InnerTube t0 = stage(s0, true, radius, 0.35, 0.009, 0.075);
    InnerTube t1 = stage(s1, false, radius, 0.12, 0.012, 0.075);
    InnerTube t2 = stage(s2, false, radius, 0.12, 0.012, 0.075);
    for (AxialStage s : new AxialStage[] { s1, s2 }) {
      StageSeparationConfiguration sep = s.getSeparationConfigurations().getDefault();
      sep.setSeparationEvent(StageSeparationConfiguration.SeparationEvent.UPPER_IGNITION);
      sep.setSeparationDelay(0.0);
    }
    FlightConfigurationId id = new FlightConfigurationId(bottom ? "6a0f1c1e-1b2d-4c1a-9f00-0000000000c1" : "6a0f1c1e-1b2d-4c1a-9f00-0000000000c2");
    Motor c6 = ReferenceHarness.loadMotor(motorDir, "Estes_C6.eng", "C6");
    Motor d12 = ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12");
    MotorConfiguration top = new MotorConfiguration(t0, id);
    top.setMotor(c6); top.setEjectionDelay(5.0);
    top.setIgnitionEvent(IgnitionEvent.AUTOMATIC); top.setIgnitionDelay(0.0);
    t0.setMotorConfig(top, id);
    InnerTube lit = bottom ? t1 : t2;
    MotorConfiguration low = new MotorConfiguration(lit, id);
    low.setMotor(d12); low.setEjectionDelay(0.0);
    low.setIgnitionEvent(IgnitionEvent.AUTOMATIC); low.setIgnitionDelay(0.0);
    lit.setMotorConfig(low, id);
    r.createFlightConfiguration(id);
    r.setSelectedConfiguration(id);
    File f = new File(outDir, name + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    return f;
  }

  /** The file's text, unzipped when OpenRocket saved it as a zip. */
  static String fileText(File f) throws Exception {
    byte[] bytes = java.nio.file.Files.readAllBytes(f.toPath());
    if (bytes.length > 1 && bytes[0] == 'P' && bytes[1] == 'K') {
      try (java.util.zip.ZipInputStream z = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(bytes))) {
        z.getNextEntry();
        return new String(z.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
      }
    }
    return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
  }

  /**
   * The words OpenRocket writes for each ignition and separation event: staged-bp saved once per
   * event, with the sustainer's ignition (and a 0.25 s delay) or the booster's separation (with a
   * 0.25 s delay and a 123 m altitude) set to it, and the matching elements of the file printed.
   */
  static void events(File motorDir, File outDir) throws Exception {
    outDir.mkdirs();
    for (IgnitionEvent e : IgnitionEvent.values()) {
      File f = build("staged-bp", motorDir, outDir);
      OpenRocketDocument doc = new GeneralRocketLoader(f).load();
      Rocket r = doc.getRocket();
      FlightConfigurationId id = r.getSelectedConfiguration().getFlightConfigurationID();
      for (RocketComponent c : r) {
        if (c instanceof InnerTube && c.getStageNumber() == 0 && ((InnerTube) c).isMotorMount()) {
          MotorConfiguration mc = ((InnerTube) c).getMotorConfig(id);
          mc.setIgnitionEvent(e); mc.setIgnitionDelay(0.25);
        }
      }
      new GeneralRocketSaver().save(f, doc);
      for (String line : fileText(f).split("\n")) {
        if (line.contains("<ignitionevent>") || line.contains("<ignitiondelay>")) System.out.printf("ignition %s:%s%n", e.name(), line);
      }
    }
    for (StageSeparationConfiguration.SeparationEvent e : StageSeparationConfiguration.SeparationEvent.values()) {
      File f = build("staged-bp", motorDir, outDir);
      OpenRocketDocument doc = new GeneralRocketLoader(f).load();
      Rocket r = doc.getRocket();
      AxialStage booster = (AxialStage) r.getChild(1);
      StageSeparationConfiguration sep = booster.getSeparationConfigurations().getDefault();
      sep.setSeparationEvent(e); sep.setSeparationDelay(0.25); sep.setSeparationAltitude(123.0);
      new GeneralRocketSaver().save(f, doc);
      boolean inBooster = false;
      for (String line : fileText(f).split("\n")) {
        if (line.contains("<name>Booster</name>")) inBooster = true;
        if (inBooster && line.contains("<separation")) System.out.printf("separation %s:%s%n", e.name(), line);
        if (inBooster && line.contains("<subcomponents>")) inBooster = false;
      }
    }
  }

  /**
   * A stage switched off in the configuration: "staged-off-booster" is staged-bp with its booster
   * off; "staged-off-middle" has three stages, C6-5 on D12-0 on D12-0 (all automatic, separating
   * at the upper stage's ignition), with the middle stage off.
   */
  static File inactive(String name, File motorDir, File outDir) throws Exception {
    File f;
    if (name.equals("staged-off-booster")) {
      f = build("staged-bp", motorDir, outDir);
    } else {
      Rocket r = new Rocket(); r.setName(name);
      AxialStage s0 = new AxialStage(); s0.setName("Sustainer"); r.addChild(s0);
      AxialStage s1 = new AxialStage(); s1.setName("Middle"); r.addChild(s1);
      AxialStage s2 = new AxialStage(); s2.setName("Bottom"); r.addChild(s2);
      double radius = 0.0165;
      InnerTube t0 = stage(s0, true, radius, 0.35, 0.009, 0.075);
      InnerTube t1 = stage(s1, false, radius, 0.12, 0.012, 0.075);
      InnerTube t2 = stage(s2, false, radius, 0.12, 0.012, 0.075);
      for (AxialStage s : new AxialStage[] { s1, s2 }) {
        StageSeparationConfiguration sep = s.getSeparationConfigurations().getDefault();
        sep.setSeparationEvent(StageSeparationConfiguration.SeparationEvent.UPPER_IGNITION);
        sep.setSeparationDelay(0.0);
      }
      FlightConfigurationId id = new FlightConfigurationId("6a0f1c1e-1b2d-4c1a-9f00-0000000000d2");
      Motor c6 = ReferenceHarness.loadMotor(motorDir, "Estes_C6.eng", "C6");
      Motor d12 = ReferenceHarness.loadMotor(motorDir, "Estes_D12.eng", "D12");
      MotorConfiguration m0 = new MotorConfiguration(t0, id);
      m0.setMotor(c6); m0.setEjectionDelay(5.0); m0.setIgnitionEvent(IgnitionEvent.AUTOMATIC);
      t0.setMotorConfig(m0, id);
      for (InnerTube t : new InnerTube[] { t1, t2 }) {
        MotorConfiguration m = new MotorConfiguration(t, id);
        m.setMotor(d12); m.setEjectionDelay(0.0); m.setIgnitionEvent(IgnitionEvent.AUTOMATIC);
        t.setMotorConfig(m, id);
      }
      r.createFlightConfiguration(id);
      r.setSelectedConfiguration(id);
      f = new File(outDir, name + ".ork");
      new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    }
    OpenRocketDocument doc = new GeneralRocketLoader(f).load();
    Rocket r = doc.getRocket();
    r.getSelectedConfiguration().clearStage(1);
    File out = new File(outDir, name + ".ork");
    new GeneralRocketSaver().save(out, doc);
    for (String line : fileText(out).split("\n")) {
      if (line.contains("<stage number=")) System.out.printf("  file:%s%n", line);
    }
    return out;
  }

  static void probe(File f) throws Exception {
    OpenRocketDocument doc = new GeneralRocketLoader(f).load();
    Rocket rocket = doc.getRocket();
    FlightConfiguration config = rocket.getSelectedConfiguration();
    FlightConfigurationId id = config.getFlightConfigurationID();
    System.out.printf("file %s config %s%n", f.getName(), id);
    int stageIndex = 0;
    for (RocketComponent c : rocket.getChildren()) {
      if (!(c instanceof AxialStage)) continue;
      AxialStage s = (AxialStage) c;
      StageSeparationConfiguration sep = s.getSeparationConfigurations().get(id);
      System.out.printf("  stage %d \"%s\" number=%d separation=%s delay=%.3f active=%s%n", stageIndex, s.getName(),
          s.getStageNumber(), sep.getSeparationEvent(), sep.getSeparationDelay(), config.isStageActive(s.getStageNumber()));
      stageIndex++;
    }
    for (RocketComponent c : rocket) {
      if (!(c instanceof MotorMount) || !((MotorMount) c).isMotorMount()) continue;
      MotorMount m = (MotorMount) c;
      MotorConfiguration mc = m.getMotorConfig(id);
      System.out.printf("  mount \"%s\" stage=%d motor=%s ignition=%s ignitionDelay=%.3f ejectionDelay=%.3f%n", c.getName(),
          c.getStageNumber(), mc.getMotor() == null ? "none" : mc.getMotor().getDesignation(), mc.getIgnitionEvent(),
          mc.getIgnitionDelay(), mc.getEjectionDelay());
    }
    Simulation sim = new Simulation(doc, rocket);
    sim.setFlightConfigurationId(id);
    ReferenceHarness.configure(sim.getOptions(), 0.0);
    sim.simulate();
    FlightData d = sim.getSimulatedData();
    System.out.printf("  sustainer: apogee %.3f m, max v %.3f m/s, max Mach %.4f, rail exit %.3f m/s, t_apogee %.3f s, flight time %.3f s%n",
        d.getMaxAltitude(), d.getMaxVelocity(), d.getMaxMachNumber(), d.getLaunchRodVelocity(), d.getTimeToApogee(), d.getFlightTime());
    for (int b = 0; b < d.getBranchCount(); b++) {
      FlightDataBranch br = d.getBranch(b);
      System.out.printf("  branch %d \"%s\" max altitude %.3f m%n", b, br.getName(), br.getMaximum(FlightDataType.TYPE_ALTITUDE));
      for (FlightEvent e : br.getEvents()) {
        System.out.printf("    %.4f s %s %s%n", e.getTime(), e.getType(), e.getSource() == null ? "" : "(" + e.getSource().getName() + ")");
      }
    }
    FlightDataBranch main = d.getBranch(0);
    List<Double> t = main.get(FlightDataType.TYPE_TIME);
    List<Double> mass = main.get(FlightDataType.TYPE_MASS);
    List<Double> cg = main.get(FlightDataType.TYPE_CG_LOCATION);
    List<Double> cd = main.get(FlightDataType.TYPE_DRAG_COEFF);
    for (FlightEvent e : main.getEvents()) {
      if (e.getType() != FlightEvent.Type.STAGE_SEPARATION && e.getType() != FlightEvent.Type.IGNITION && e.getType() != FlightEvent.Type.BURNOUT) continue;
      int i = 0;
      while (i < t.size() - 1 && t.get(i + 1) < e.getTime() - 1e-9) i++;
      int j = Math.min(t.size() - 1, i + 3);
      for (int k = Math.max(0, i - 1); k <= j; k++) {
        System.out.printf("    around %s at %.4f: t=%.4f mass=%.6f cg=%.6f cd=%.4f%n", e.getType(), e.getTime(), t.get(k), mass.get(k), cg.get(k), cd.get(k));
      }
    }
  }
}
