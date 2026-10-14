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
 * Black-box probe (plan 0073): how OpenRocket writes each surface finish to
 * the file and the roughness it gives it, how a part's own finish enters its
 * skin friction, and what it does with a streamer (file elements, mass, drag
 * coefficient). Each rocket is saved, reloaded and measured as loaded.
 * Output kept in reference/rockets/finish-probe/.
 *   javac -d out -cp lib/OpenRocket-24.12.jar src/FinishProbe.java
 *   java -Djava.awt.headless=true -cp out:lib/OpenRocket-24.12.jar FinishProbe
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
import info.openrocket.core.rocketcomponent.ExternalComponent.Finish;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.startup.OpenRocketCore;
import java.io.*;
import java.util.Locale;
import java.util.Map;

public final class FinishProbe {
  static Material bulk(String n, double d) { return Material.newMaterial(Material.Type.BULK, n, d, true); }
  static Material surface(String n, double d) { return Material.newMaterial(Material.Type.SURFACE, n, d, true); }

  public static void main(String[] a) throws Exception {
    Locale.setDefault(Locale.US);
    OpenRocketCore.initialize();
    for (Finish f : Finish.values()) {
      System.out.printf("FINISH %s roughness=%.9e label=\"%s\"%n", f.name(), f.getRoughnessSize(), f.toString());
    }
    // Part 1: every external part with the same finish.
    for (Finish f : Finish.values()) measure("uniform-" + f.name().toLowerCase(Locale.US), f, f, f, f);
    // Part 2: mixed finishes, and each part's finish alone.
    measure("mixed", Finish.POLISHED, Finish.ROUGH, Finish.SMOOTH, Finish.UNFINISHED);
    measure("nose-rough", Finish.ROUGH, Finish.NORMAL, Finish.NORMAL, Finish.NORMAL);
    measure("body-rough", Finish.NORMAL, Finish.ROUGH, Finish.NORMAL, Finish.NORMAL);
    measure("fins-rough", Finish.NORMAL, Finish.NORMAL, Finish.ROUGH, Finish.NORMAL);
    measure("lug-rough", Finish.NORMAL, Finish.NORMAL, Finish.NORMAL, Finish.ROUGH);
    // Part 3: streamers.
    System.out.printf("STREAMER DEFAULT_CD=%.9e MAX_COMPUTED_CD=%.9e%n", Streamer.DEFAULT_CD, Streamer.MAX_COMPUTED_CD);
    double[][] strips = {
      {0.6, 0.06, 0.080}, {0.21, 0.07, 0.021}, {0.49, 0.07, 0.041}, {0.24, 0.08, 0.010},
      {0.70, 0.06, 0.020}, {0.50, 0.06, 0.024}, {1.0, 0.1, 0.080}, {0.1, 0.1, 0.080}, {2.0, 0.05, 0.030},
      {0.05, 0.5, 0.080},
    };
    for (int i = 0; i < strips.length; i++) streamer(i, strips[i][0], strips[i][1], strips[i][2]);
  }

  static void measure(String tag, Finish nf, Finish bf, Finish ff, Finish lf) throws Exception {
    Rocket r = new Rocket(); r.setName(tag);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.150, 0.025);
    nose.setShapeParameter(1.0); nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160));
    nose.setFinish(nf); st.addChild(nose);
    BodyTube bt = new BodyTube(0.6, 0.025, 0.001); bt.setMaterial(bulk("paper700", 700)); bt.setFinish(bf);
    st.addChild(bt); bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.08, 0.04, 0.03, 0.06);
    fins.setThickness(0.003); fins.setMaterial(bulk("ply630", 630)); fins.setFinish(ff);
    bt.addChild(fins); fins.setAxialMethod(AxialMethod.BOTTOM); fins.setAxialOffset(0.0);
    LaunchLug lug = new LaunchLug(); lug.setLength(0.04); lug.setOuterRadius(0.003); lug.setThickness(0.0005);
    lug.setMaterial(bulk("paper700", 700)); lug.setFinish(lf);
    bt.addChild(lug); lug.setAxialMethod(AxialMethod.TOP); lug.setAxialOffset(0.3);
    File f = new File("finish-" + tag + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    FlightConfiguration config = loaded.getSelectedConfiguration();
    for (double m : new double[] {0.1, 0.3, 0.8, 1.5}) {
      FlightConditions fc = new FlightConditions(config);
      fc.setMach(m); fc.setAOA(0.0); fc.setRollRate(0.0);
      BarrowmanCalculator aero = new BarrowmanCalculator();
      Map<RocketComponent, AerodynamicForces> forces = aero.getForceAnalysis(config, fc, new WarningSet());
      for (RocketComponent k : loaded) {
        AerodynamicForces af = forces.get(k);
        if (af == null || !(k instanceof ExternalComponent)) continue;
        System.out.printf("%s M=%.2f %s finish=%s friction=%.9e pressure=%.9e%n", tag, m, k.getClass().getSimpleName(),
            ((ExternalComponent) k).getFinish().name(), af.getFrictionCD(), af.getPressureCD());
      }
      AerodynamicForces total = aero.getAerodynamicForces(config, fc, new WarningSet());
      System.out.printf("%s M=%.2f total cd=%.9e friction=%.9e pressure=%.9e base=%.9e%n", tag, m, total.getCD(),
          total.getFrictionCD(), total.getPressureCD(), total.getBaseCD());
    }
  }

  static void streamer(int i, double length, double width, double density) throws Exception {
    Rocket r = new Rocket(); r.setName("streamer" + i);
    AxialStage st = new AxialStage(); r.addChild(st);
    NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.1, 0.0125);
    nose.setFilled(true); nose.setMaterial(bulk("balsa160", 160)); st.addChild(nose);
    BodyTube bt = new BodyTube(0.3, 0.0125, 0.0005); bt.setMaterial(bulk("paper700", 700));
    st.addChild(bt); bt.setAxialMethod(AxialMethod.AFTER); bt.setAxialOffset(0.0);
    Streamer s = new Streamer(); s.setName("Strip");
    s.setStripLength(length); s.setStripWidth(width);
    s.setMaterial(surface("strip" + i, density));
    bt.addChild(s); s.setAxialMethod(AxialMethod.TOP); s.setAxialOffset(0.05);
    File f = new File("streamer" + i + ".ork");
    new GeneralRocketSaver().save(f, OpenRocketDocumentFactory.createDocumentFromRocket(r));
    Rocket loaded = new GeneralRocketLoader(f).load().getRocket();
    for (RocketComponent k : loaded) {
      if (!(k instanceof Streamer)) continue;
      Streamer t = (Streamer) k;
      System.out.printf("STREAMER %d length=%.4f width=%.4f density=%.4f mass=%.9e area=%.9e cdAuto=%b cd=%.9e cdA=%.9e packedLength=%.6f packedRadius=%.6f%n",
          i, t.getStripLength(), t.getStripWidth(), t.getMaterial().getDensity(), t.getComponentMass(), t.getArea(),
          t.isCDAutomatic(), t.getCD(), t.getCD() * t.getArea(), t.getLength(), t.getRadius());
      for (double m : new double[] {0.0, 0.05, 0.3}) {
        System.out.printf("STREAMER %d componentCD(%.2f)=%.9e%n", i, m, t.getComponentCD(m));
      }
    }
    RigidBody structure = MassCalculator.calculateStructure(loaded.getSelectedConfiguration());
    System.out.printf("STREAMER %d structure mass=%.9e cg=%.9f%n", i, structure.getMass(), structure.getCM().x);
  }
}
