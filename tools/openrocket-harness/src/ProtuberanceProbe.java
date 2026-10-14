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
 * Black-box probe (plan 0071, D-108): rail button and launch lug drag. A
 * 0.1 m ogive nose and a 25 mm body tube with three fins; the part's drag
 * is the rocket's drag coefficient with it minus without it, at zero angle
 * of attack (OpenRocket's static conditions unless --temperature is given).
 * With no argument: one-variable sweeps (protuberance-sweeps.csv). With
 * "--grid": a height by position by Mach grid. With "--cases <file>": the
 * cases listed in a CSV (tag, Mach, x from the nose tip, height, OD, ID,
 * base, flange, count, separation, body length[, body radius]); with
 * "--temperature <K> <file>" at that temperature.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/ProtuberanceProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar ProtuberanceProbe [--cases f]
 */
import info.openrocket.core.aerodynamics.AerodynamicForces;
import info.openrocket.core.document.OpenRocketDocumentFactory;
import info.openrocket.core.file.GeneralRocketLoader;
import info.openrocket.core.file.GeneralRocketSaver;
import java.io.File;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.material.Material;
import info.openrocket.core.rocketcomponent.*;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.util.Locale;
import java.util.Map;

public final class ProtuberanceProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }

  /** Case parameters; lengths in metres. */
  static final class P {
    String kind = "button"; // button | lug
    double noseLength = 0.1, bodyRadius = 0.025, bodyLength = 0.5;
    double x = 0.35; // part front from the body tube's front ("top")
    int count = 2; double separation = 0.1;
    double od = 0.010, id = 0.006, height = 0.010, base = 0.002, flange = 0.002;
    double lugOuter = 0.003, lugThick = 0.0005, lugLength = 0.05;
    double mach = 0.3;
    boolean fins = true;
    P copy() { P p = new P(); p.kind = kind; p.noseLength = noseLength; p.bodyRadius = bodyRadius; p.bodyLength = bodyLength; p.x = x; p.count = count; p.separation = separation; p.od = od; p.id = id; p.height = height; p.base = base; p.flange = flange; p.lugOuter = lugOuter; p.lugThick = lugThick; p.lugLength = lugLength; p.mach = mach; p.fins = fins; return p; }
  }

  static FlightConfiguration build(P p, boolean withPart) throws Exception {
    Rocket made = make(p, withPart);
    File f = File.createTempFile("prot", ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(made));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    f.delete();
    return loaded.getSelectedConfiguration();
  }

  static Rocket make(P p, boolean withPart) {
    Rocket r = new Rocket();
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, p.noseLength, p.bodyRadius);
    nose.setFilled(true); nose.setMaterial(bulk("balsa", 160));
    st.addChild(nose);
    BodyTube bt = new BodyTube(p.bodyLength, p.bodyRadius, 0.001); bt.setMaterial(bulk("paper", 700));
    st.addChild(bt);
    bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    if (p.fins) {
      TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.1, 0.05, 0.05, 0.08);
      fins.setThickness(0.003); fins.setMaterial(bulk("ply", 600));
      fins.setCrossSection(FinSet.CrossSection.SQUARE);
      bt.addChild(fins);
      fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    }
    if (withPart) {
      if (p.kind.equals("button")) {
        RailButton b = new RailButton();
        bt.addChild(b);
        b.setOuterDiameter(p.od); b.setInnerDiameter(p.id);
        b.setTotalHeight(p.height); b.setBaseHeight(p.base); b.setFlangeHeight(p.flange); b.setScrewHeight(0.0);
        b.setInstanceCount(p.count); b.setInstanceSeparation(p.separation);
        b.setAxialMethod(AxialMethod.TOP); b.setAxialOffset(p.x);
      } else {
        LaunchLug l = new LaunchLug();
        bt.addChild(l);
        l.setOuterRadius(p.lugOuter); l.setThickness(p.lugThick); l.setLength(p.lugLength);
        l.setInstanceCount(p.count); l.setInstanceSeparation(p.separation);
        l.setAxialMethod(AxialMethod.TOP); l.setAxialOffset(p.x);
      }
    }
    return r;
  }

  static double temperature = Double.NaN;

  static double[] cd(FlightConfiguration c, double mach) {
    FlightConditions fc = new FlightConditions(c);
    if (!Double.isNaN(temperature)) fc.setAtmosphericConditions(new info.openrocket.core.models.atmosphere.AtmosphericConditions(temperature, 101325));
    fc.setMach(mach); fc.setAOA(0); fc.setRollRate(0);
    if (System.getenv("PRINT_ATM") != null) { info.openrocket.core.models.atmosphere.AtmosphericConditions at = fc.getAtmosphericConditions(); System.out.printf("ATM T=%.6f p=%.4f rho=%.8f nu=%.8e a=%.6f%n", at.getTemperature(), at.getPressure(), at.getDensity(), at.getKinematicViscosity(), at.getMachSpeed()); }
    BarrowmanCalculator calc = new BarrowmanCalculator();
    AerodynamicForces t = calc.getAerodynamicForces(c, fc, new WarningSet());
    double part = Double.NaN;
    Map<RocketComponent, AerodynamicForces> map = calc.getForceAnalysis(c, fc, new WarningSet());
    for (Map.Entry<RocketComponent, AerodynamicForces> e : map.entrySet()) {
      if ((e.getKey() instanceof RailButton || e.getKey() instanceof LaunchLug) && e.getValue() != null) part = e.getValue().getCD();
    }
    return new double[] { t.getCD(), t.getPressureCD(), fc.getRefArea(), fc.getVelocity(), part, fc.getRefLength() };
  }

  static void run(String tag, P p) throws Exception {
    double[] w = cd(build(p, true), p.mach);
    double[] wo = cd(build(p, false), p.mach);
    double delta = w[0] - wo[0];
    System.out.printf("ROW,%s,%s,%.4f,%.5f,%.5f,%.5f,%d,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.9f,%.6e,%.6f,%.9f,%.6f%n",
        tag, p.kind, p.mach, p.noseLength, p.bodyRadius, p.bodyLength, p.count, p.x, p.od, p.id, p.height, p.base, p.flange,
        p.lugOuter, p.lugThick, p.lugLength, p.separation, delta, w[2], w[3], w[4], w[5]);
  }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    if (a.length > 2 && a[0].equals("--temperature")) { temperature = Double.parseDouble(a[1]); a = new String[] { "--cases", a[2] }; }
    if (a.length > 1 && a[0].equals("--cases")) {
      System.out.println("HEAD,tag,kind,mach,noseLength,bodyRadius,bodyLength,count,x,od,id,height,base,flange,lugOuter,lugThick,lugLength,separation,deltaCd,refArea,velocity,partCd,refLength");
      for (String line : java.nio.file.Files.readAllLines(java.nio.file.Paths.get(a[1]))) {
        String[] f = line.trim().split(",");
        if (f.length < 11 || f[0].startsWith("#")) continue;
        P p = new P(); p.mach = Double.parseDouble(f[1]); p.x = Double.parseDouble(f[2]) - p.noseLength; p.height = Double.parseDouble(f[3]);
        p.od = Double.parseDouble(f[4]); p.id = Double.parseDouble(f[5]); p.base = Double.parseDouble(f[6]); p.flange = Double.parseDouble(f[7]);
        p.count = Integer.parseInt(f[8]); p.separation = Double.parseDouble(f[9]); p.bodyLength = Double.parseDouble(f[10]); p.bodyRadius = f.length > 11 ? Double.parseDouble(f[11]) : 0.025;
        run(f[0], p);
      }
      return;
    }
    if (a.length > 0 && a[0].equals("--grid")) {
      System.out.println("HEAD,tag,kind,mach,noseLength,bodyRadius,bodyLength,count,x,od,id,height,base,flange,lugOuter,lugThick,lugLength,separation,deltaCd,refArea,velocity,partCd,refLength");
      for (double m : new double[] { 0.1, 0.3, 0.6, 0.9, 1.5, 2.5 }) {
        for (double xa : new double[] { 0.15, 0.3, 0.6, 1.2 }) {
          for (double h : new double[] { 0.002, 0.003, 0.004, 0.005, 0.006, 0.008, 0.010, 0.013, 0.016, 0.020, 0.025, 0.030, 0.040, 0.060, 0.100 }) {
            P p = new P(); p.mach = m; p.count = 1; p.bodyLength = 1.5; p.x = xa - p.noseLength; p.height = h; p.base = 0; p.flange = 0; p.od = 0.012; p.id = 0.006;
            run("grid", p);
          }
        }
      }
      return;
    }
    System.out.println("HEAD,tag,kind,mach,noseLength,bodyRadius,bodyLength,count,x,od,id,height,base,flange,lugOuter,lugThick,lugLength,separation,deltaCd,refArea,velocity,partCd,refLength");
    P b = new P();
    run("base", b);
    for (double x = 0.02; x <= 0.381; x += 0.04) { P p = b.copy(); p.x = x; run("x", p); }
    for (double m : new double[] { 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99, 1.0, 1.01, 1.05, 1.1, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0 }) { P p = b.copy(); p.mach = m; run("mach", p); }
    for (double od : new double[] { 0.007, 0.008, 0.010, 0.012, 0.015, 0.020 }) { P p = b.copy(); p.od = od; run("od", p); }
    for (double id : new double[] { 0.002, 0.003, 0.004, 0.005, 0.006, 0.007, 0.008, 0.009 }) { P p = b.copy(); p.id = id; run("id", p); }
    for (double h : new double[] { 0.005, 0.006, 0.008, 0.010, 0.012, 0.015, 0.020, 0.030 }) { P p = b.copy(); p.height = h; run("height", p); }
    for (double bh : new double[] { 0.0, 0.001, 0.002, 0.003, 0.004 }) { P p = b.copy(); p.base = bh; run("base", p); }
    for (double fh : new double[] { 0.0, 0.001, 0.002, 0.003, 0.004 }) { P p = b.copy(); p.flange = fh; run("flange", p); }
    for (int n : new int[] { 1, 2, 3, 4 }) { P p = b.copy(); p.count = n; p.separation = 0.05; run("count", p); }
    for (double br : new double[] { 0.0125, 0.019, 0.025, 0.04, 0.06 }) { P p = b.copy(); p.bodyRadius = br; run("bodyRadius", p); }
    for (double bl : new double[] { 0.45, 0.5, 0.8, 1.2, 2.0 }) { P p = b.copy(); p.bodyLength = bl; run("bodyLength", p); }
    for (double nl : new double[] { 0.05, 0.1, 0.2, 0.4 }) { P p = b.copy(); p.noseLength = nl; run("noseLength", p); }
    for (double sep : new double[] { 0.0, 0.02, 0.1, 0.3 }) { P p = b.copy(); p.separation = sep; run("separation", p); }
    { P p = b.copy(); p.fins = false; run("nofins", p); }
    // Mach sweep at two positions to see if the position effect changes with Mach
    for (double m : new double[] { 0.1, 0.5, 0.9, 1.2, 2.0 }) { P p = b.copy(); p.mach = m; p.x = 0.02; run("machFront", p); }
    // Lugs
    P l = new P(); l.kind = "lug"; l.count = 1;
    run("lugBase", l);
    for (double x = 0.02; x <= 0.381; x += 0.04) { P p = l.copy(); p.x = x; run("lugX", p); }
    for (double m : new double[] { 0.05, 0.1, 0.3, 0.5, 0.8, 0.9, 1.0, 1.1, 1.5, 2.0, 3.0 }) { P p = l.copy(); p.mach = m; run("lugMach", p); }
    for (double len : new double[] { 0.005, 0.01, 0.02, 0.03, 0.05, 0.1 }) { P p = l.copy(); p.lugLength = len; run("lugLength", p); }
    for (double ro : new double[] { 0.002, 0.003, 0.004, 0.006, 0.008 }) { P p = l.copy(); p.lugOuter = ro; run("lugOuter", p); }
    for (double t : new double[] { 0.0002, 0.0005, 0.001, 0.0015, 0.0025 }) { P p = l.copy(); p.lugThick = t; run("lugThick", p); }
    for (double br : new double[] { 0.0125, 0.025, 0.05 }) { P p = l.copy(); p.bodyRadius = br; run("lugBodyRadius", p); }
    for (double bl : new double[] { 0.5, 1.0, 2.0 }) { P p = l.copy(); p.bodyLength = bl; run("lugBodyLength", p); }
    for (int n : new int[] { 1, 2, 3 }) { P p = l.copy(); p.count = n; p.separation = 0.06; run("lugCount", p); }
  }
}
