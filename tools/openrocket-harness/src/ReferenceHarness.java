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
 * This harness links against OpenRocket (GPLv3) and is therefore GPLv3
 * itself. It is a black-box tool: it builds the reference rockets with
 * OpenRocket's own classes, asks OpenRocket for CG, CP, stability and
 * flight results, and writes them to CSV. Nothing in packages/ imports
 * or bundles any of this.
 */

import info.openrocket.core.aerodynamics.AerodynamicCalculator;
import info.openrocket.core.aerodynamics.BarrowmanCalculator;
import info.openrocket.core.aerodynamics.FlightConditions;
import info.openrocket.core.document.OpenRocketDocument;
import info.openrocket.core.document.OpenRocketDocumentFactory;
import info.openrocket.core.document.Simulation;
import info.openrocket.core.file.GeneralRocketSaver;
import info.openrocket.core.file.motor.GeneralMotorLoader;
import info.openrocket.core.logging.WarningSet;
import info.openrocket.core.masscalc.MassCalculator;
import info.openrocket.core.masscalc.RigidBody;
import info.openrocket.core.material.Material;
import info.openrocket.core.models.gravity.WGSGravityModel;
import info.openrocket.core.motor.Motor;
import info.openrocket.core.motor.MotorConfiguration;
import info.openrocket.core.motor.ThrustCurveMotor;
import info.openrocket.core.rocketcomponent.AxialStage;
import info.openrocket.core.rocketcomponent.BodyTube;
import info.openrocket.core.rocketcomponent.Bulkhead;
import info.openrocket.core.rocketcomponent.CenteringRing;
import info.openrocket.core.rocketcomponent.DeploymentConfiguration;
import info.openrocket.core.rocketcomponent.ExternalComponent;
import info.openrocket.core.rocketcomponent.FinSet;
import info.openrocket.core.rocketcomponent.FlightConfiguration;
import info.openrocket.core.rocketcomponent.FlightConfigurationId;
import info.openrocket.core.rocketcomponent.InnerTube;
import info.openrocket.core.rocketcomponent.LaunchLug;
import info.openrocket.core.rocketcomponent.MassComponent;
import info.openrocket.core.rocketcomponent.MotorMount;
import info.openrocket.core.rocketcomponent.NoseCone;
import info.openrocket.core.rocketcomponent.Parachute;
import info.openrocket.core.rocketcomponent.RailButton;
import info.openrocket.core.rocketcomponent.Rocket;
import info.openrocket.core.rocketcomponent.RocketComponent;
import info.openrocket.core.rocketcomponent.StructuralComponent;
import info.openrocket.core.rocketcomponent.Transition;
import info.openrocket.core.rocketcomponent.TrapezoidFinSet;
import info.openrocket.core.rocketcomponent.position.AxialMethod;
import info.openrocket.core.simulation.FlightData;
import info.openrocket.core.simulation.FlightDataBranch;
import info.openrocket.core.simulation.FlightDataType;
import info.openrocket.core.simulation.SimulationOptions;
import info.openrocket.core.startup.OpenRocketCore;
import info.openrocket.core.util.Coordinate;
import info.openrocket.core.util.GeodeticComputationStrategy;
import info.openrocket.core.util.WorldCoordinate;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class ReferenceHarness {

    // ----- Pinned analysis and simulation settings (see reference/rockets/settings.md) -----
    static final double STABILITY_MACH = 0.3;      // OpenRocket design-window default
    static final double STABILITY_AOA = 0.0;       // radians
    static final double LAUNCH_ROD_LENGTH = 1.5;   // m
    static final double LAUNCH_ROD_ANGLE = 0.0;    // radians, vertical
    static final double LAUNCH_ROD_DIRECTION = Math.PI / 2; // radians, OpenRocket default
    static final double SITE_ALTITUDE = 0.0;       // m
    static final double SITE_LATITUDE = 45.0;      // degrees
    static final double SITE_LONGITUDE = 0.0;      // degrees
    static final double TIME_STEP = Double.parseDouble(System.getProperty("harness.timeStep", "0.01")); // s (OpenRocket GUI default is 0.05)
    static final double MAX_SIM_TIME = 600.0;      // s
    static final double WIND_DIRECTION = Math.PI / 2; // radians, OpenRocket default
    static final double WIND_TURBULENCE = 0.0;
    static final int RANDOM_SEED = 1;
    static final double[] WIND_SPEEDS = {0.0, 5.0};
    static final String OR_VERSION = "24.12";

    // ----- Materials: bulk densities in kg/m^3, round numbers -----
    static final Material PAPER = bulk("Reference paper 700", 700);
    static final Material BALSA = bulk("Reference balsa 160", 160);
    static final Material PLYWOOD = bulk("Reference plywood 600", 600);
    static final Material PLASTIC = bulk("Reference plastic 1050", 1050);
    static final Material FIBERGLASS = bulk("Reference fiberglass 1850", 1850);
    static final Material NYLON = bulk("Reference nylon 1150", 1150);

    static Material bulk(String name, double density) {
        return Material.newMaterial(Material.Type.BULK, name, density, true);
    }

    static final class Spec {
        final String name;
        final String motorFile;
        final String motorDesignation;
        final double ejectionDelay;
        final Rocket rocket;
        final FlightConfigurationId fcid;
        Spec(String name, String motorFile, String motorDesignation, double ejectionDelay, Rocket rocket, FlightConfigurationId fcid) {
            this.name = name; this.motorFile = motorFile; this.motorDesignation = motorDesignation;
            this.ejectionDelay = ejectionDelay; this.rocket = rocket; this.fcid = fcid;
        }
    }

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.US);
        File outDir = new File(args.length > 0 ? args[0] : "reference/rockets");
        File motorDir = new File(args.length > 1 ? args[1] : "reference/motors");
        outDir.mkdirs();
        new File(outDir, "timeseries").mkdirs();
        new File(outDir, "components").mkdirs();

        OpenRocketCore.initialize();

        double g45 = new WGSGravityModel().getGravity(new WorldCoordinate(SITE_LATITUDE, SITE_LONGITUDE, SITE_ALTITUDE));
        System.out.printf("OpenRocket WGS gravity at lat %.1f deg, alt %.0f m: %.10f m/s^2%n", SITE_LATITUDE, SITE_ALTITUDE, g45);

        List<Spec> specs = new ArrayList<>();
        specs.add(rocket1());
        specs.add(rocket2());
        specs.add(rocket3());
        specs.add(rocket4());
        specs.add(rocket5());

        try (PrintWriter values = new PrintWriter(new File(outDir, "values.csv"))) {
            values.println("rocket_file,motor,openrocket_version,mach,cg_m,cp_m,stability_cal,apogee_m,max_velocity_ms,rail_exit_velocity_ms,launch_rail_m,wind_ms,site_altitude_m,"
                + "ref_diameter_m,liftoff_mass_kg,burnout_mass_kg,cg_burnout_m,max_mach,max_acceleration_ms2,time_to_apogee_s,flight_time_s,deployment_velocity_ms,ground_hit_velocity_ms,time_step_s,warnings");
            for (Spec spec : specs) {
                processRocket(spec, motorDir, outDir, values, g45);
            }
        }
        System.out.println("Done.");
    }

    // ------------------------------------------------------------------
    // Rocket definitions. All dimensions in metres, masses in kilograms.
    // Positions use AxialMethod.TOP: offset of the component's forward end
    // from the forward end of its parent, positive aft. Fins use BOTTOM with
    // zero offset: trailing edge flush with the parent's aft end.
    // ------------------------------------------------------------------

    /** R1: conical nose, one body tube, three fins, 24 mm mount, Estes D12-5. The hand-check rocket. */
    static Spec rocket1() {
        Rocket rocket = new Rocket();
        rocket.setName("r1-three-fin-conical");
        FlightConfigurationId fcid = new FlightConfigurationId();
        rocket.createFlightConfiguration(fcid);
        AxialStage stage = new AxialStage();
        stage.setName("Sustainer");
        rocket.addChild(stage);

        NoseCone nose = new NoseCone(Transition.Shape.CONICAL, 0.100, 0.025);
        nose.setName("Nose cone (conical, solid balsa)");
        nose.setFilled(true);
        nose.setMaterial(BALSA);
        nose.setFinish(ExternalComponent.Finish.NORMAL);
        nose.setAftShoulderLength(0.0);
        stage.addChild(nose);

        BodyTube body = new BodyTube(0.500, 0.025, 0.001);
        body.setName("Body tube");
        body.setMaterial(PAPER);
        body.setFinish(ExternalComponent.Finish.NORMAL);
        stage.addChild(body);

        TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.100, 0.050, 0.050, 0.080);
        fins.setName("Fins (3)");
        fins.setThickness(0.003);
        fins.setCrossSection(FinSet.CrossSection.SQUARE);
        fins.setMaterial(PLYWOOD);
        fins.setFinish(ExternalComponent.Finish.NORMAL);
        fins.setAxialMethod(AxialMethod.BOTTOM);
        fins.setAxialOffset(0.0);
        body.addChild(fins);

        body.addChild(mass("Nose weight", 0.000, 0.020, 0.020, 0.030));

        LaunchLug lug = new LaunchLug();
        lug.setName("Launch lug");
        lug.setLength(0.050);
        lug.setOuterRadius(0.003);
        lug.setThickness(0.0005);   // inner radius 0.0025 m
        lug.setMaterial(PAPER);
        lug.setFinish(ExternalComponent.Finish.NORMAL);
        lug.setAxialMethod(AxialMethod.TOP);
        lug.setAxialOffset(0.250);
        body.addChild(lug);

        InnerTube mount = new InnerTube();
        mount.setName("Motor mount tube (24 mm)");
        mount.setLength(0.075);
        mount.setOuterRadius(0.0125);
        mount.setThickness(0.0005);
        mount.setMaterial(PAPER);
        mount.setAxialMethod(AxialMethod.TOP);
        mount.setAxialOffset(0.425);
        mount.setMotorMount(true);
        mount.setMotorOverhang(0.0);
        body.addChild(mount);

        for (double x : new double[] {0.430, 0.490}) {
            CenteringRing ring = new CenteringRing();
            ring.setName("Centering ring at " + x);
            ring.setLength(0.005);
            ring.setOuterRadius(0.024);
            ring.setInnerRadius(0.0125);
            ring.setMaterial(PAPER);
            ring.setAxialMethod(AxialMethod.TOP);
            ring.setAxialOffset(x);
            body.addChild(ring);
        }

        body.addChild(parachute("Parachute", 0.100, 0.050, 0.020, 0.010, 0.300));

        rocket.setSelectedConfiguration(fcid);
        rocket.enableEvents();
        return new Spec("r1-three-fin-conical", "Estes_D12.eng", "D12", 5.0, rocket, fcid);
    }

    /** R2: tangent ogive nose, 54 mm body, conical boat tail, 29 mm mount, rail buttons, AeroTech G80T-7. */
    static Spec rocket2() {
        Rocket rocket = new Rocket();
        rocket.setName("r2-ogive-boattail");
        FlightConfigurationId fcid = new FlightConfigurationId();
        rocket.createFlightConfiguration(fcid);
        AxialStage stage = new AxialStage();
        stage.setName("Sustainer");
        rocket.addChild(stage);

        NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.150, 0.027);
        nose.setName("Nose cone (tangent ogive)");
        nose.setShapeParameter(1.0);
        nose.setFilled(false);
        nose.setThickness(0.002);
        nose.setMaterial(PLASTIC);
        nose.setFinish(ExternalComponent.Finish.NORMAL);
        nose.setAftShoulderLength(0.040);
        nose.setAftShoulderRadius(0.0255);
        nose.setAftShoulderThickness(0.002);
        stage.addChild(nose);

        BodyTube body = new BodyTube(0.600, 0.027, 0.0015);
        body.setName("Body tube");
        body.setMaterial(PAPER);
        body.setFinish(ExternalComponent.Finish.NORMAL);
        stage.addChild(body);

        Transition boatTail = new Transition();
        boatTail.setName("Boat tail (conical)");
        boatTail.setShapeType(Transition.Shape.CONICAL);
        boatTail.setForeRadiusAutomatic(false);
        boatTail.setAftRadiusAutomatic(false);
        boatTail.setForeRadius(0.027);
        boatTail.setAftRadius(0.018);
        boatTail.setLength(0.050);
        boatTail.setFilled(false);
        boatTail.setThickness(0.0015);
        boatTail.setMaterial(PLASTIC);
        boatTail.setFinish(ExternalComponent.Finish.NORMAL);
        boatTail.setForeShoulderLength(0.0);
        boatTail.setAftShoulderLength(0.0);
        stage.addChild(boatTail);

        TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.120, 0.040, 0.080, 0.070);
        fins.setName("Fins (3)");
        fins.setThickness(0.003);
        fins.setCrossSection(FinSet.CrossSection.SQUARE);
        fins.setMaterial(PLYWOOD);
        fins.setFinish(ExternalComponent.Finish.NORMAL);
        fins.setAxialMethod(AxialMethod.BOTTOM);
        fins.setAxialOffset(0.0);
        body.addChild(fins);

        body.addChild(railButtons("Rail buttons (2)", 0.300, 0.250, 0.010, 0.006, 0.010, 0.002, 0.002));

        InnerTube mount = new InnerTube();
        mount.setName("Motor mount tube (29 mm)");
        mount.setLength(0.130);
        mount.setOuterRadius(0.0155);
        mount.setThickness(0.0005);
        mount.setMaterial(PAPER);
        mount.setAxialMethod(AxialMethod.TOP);
        mount.setAxialOffset(0.470);
        mount.setMotorMount(true);
        mount.setMotorOverhang(0.0);
        body.addChild(mount);

        for (double x : new double[] {0.475, 0.590}) {
            CenteringRing ring = new CenteringRing();
            ring.setName("Centering ring at " + x);
            ring.setLength(0.005);
            ring.setOuterRadius(0.0255);
            ring.setInnerRadius(0.0155);
            ring.setMaterial(PLYWOOD);
            ring.setAxialMethod(AxialMethod.TOP);
            ring.setAxialOffset(x);
            body.addChild(ring);
        }

        body.addChild(parachute("Parachute", 0.150, 0.060, 0.022, 0.030, 0.450));
        body.addChild(mass("Payload mass", 0.050, 0.050, 0.020, 0.050));

        rocket.setSelectedConfiguration(fcid);
        rocket.enableEvents();
        return new Spec("r2-ogive-boattail", "AeroTech_G80T.eng", "G80NBT", 7.0, rocket, fcid);
    }

    /** R3: 24 mm minimum-diameter fiberglass rocket, Von Karman nose, AeroTech F39T-6. */
    static Spec rocket3() {
        Rocket rocket = new Rocket();
        rocket.setName("r3-minimum-diameter-24");
        FlightConfigurationId fcid = new FlightConfigurationId();
        rocket.createFlightConfiguration(fcid);
        AxialStage stage = new AxialStage();
        stage.setName("Sustainer");
        rocket.addChild(stage);

        NoseCone nose = new NoseCone(Transition.Shape.HAACK, 0.100, 0.0127);
        nose.setName("Nose cone (Von Karman, LD-Haack)");
        nose.setShapeParameter(0.0);
        nose.setFilled(false);
        nose.setThickness(0.002);
        nose.setMaterial(FIBERGLASS);
        nose.setFinish(ExternalComponent.Finish.NORMAL);
        nose.setAftShoulderLength(0.030);
        nose.setAftShoulderRadius(0.0117);
        nose.setAftShoulderThickness(0.0015);
        stage.addChild(nose);

        BodyTube body = new BodyTube(0.450, 0.0127, 0.0007);
        body.setName("Body tube (motor mount)");
        body.setMaterial(FIBERGLASS);
        body.setFinish(ExternalComponent.Finish.NORMAL);
        body.setMotorMount(true);
        body.setMotorOverhang(0.0);
        stage.addChild(body);

        TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.070, 0.030, 0.045, 0.035);
        fins.setName("Fins (3)");
        fins.setThickness(0.002);
        fins.setCrossSection(FinSet.CrossSection.SQUARE);
        fins.setMaterial(FIBERGLASS);
        fins.setFinish(ExternalComponent.Finish.NORMAL);
        fins.setAxialMethod(AxialMethod.BOTTOM);
        fins.setAxialOffset(0.0);
        body.addChild(fins);

        body.addChild(railButtons("Rail buttons (2)", 0.200, 0.200, 0.008, 0.004, 0.008, 0.0015, 0.0015));
        body.addChild(mass("Nose weight", 0.000, 0.030, 0.010, 0.010));
        body.addChild(parachute("Parachute", 0.050, 0.080, 0.011, 0.015, 0.300));

        rocket.setSelectedConfiguration(fcid);
        rocket.enableEvents();
        return new Spec("r3-minimum-diameter-24", "AeroTech_F39T.eng", "F39T", 6.0, rocket, fcid);
    }

    /** R4: 66 mm fiberglass scratch build on a 38 mm mount with internal layout, AeroTech H123W. */
    static Spec rocket4() {
        Rocket rocket = new Rocket();
        rocket.setName("r4-scratch-38mm");
        FlightConfigurationId fcid = new FlightConfigurationId();
        rocket.createFlightConfiguration(fcid);
        AxialStage stage = new AxialStage();
        stage.setName("Sustainer");
        rocket.addChild(stage);

        NoseCone nose = new NoseCone(Transition.Shape.OGIVE, 0.200, 0.033);
        nose.setName("Nose cone (tangent ogive)");
        nose.setShapeParameter(1.0);
        nose.setFilled(false);
        nose.setThickness(0.003);
        nose.setMaterial(PLASTIC);
        nose.setFinish(ExternalComponent.Finish.NORMAL);
        nose.setAftShoulderLength(0.050);
        nose.setAftShoulderRadius(0.031);
        nose.setAftShoulderThickness(0.003);
        stage.addChild(nose);

        BodyTube body = new BodyTube(0.800, 0.033, 0.002);
        body.setName("Body tube");
        body.setMaterial(FIBERGLASS);
        body.setFinish(ExternalComponent.Finish.NORMAL);
        stage.addChild(body);

        body.addChild(mass("Electronics bay mass", 0.100, 0.100, 0.025, 0.150));

        Bulkhead bulkhead = new Bulkhead();
        bulkhead.setName("Bulkhead");
        bulkhead.setLength(0.006);
        bulkhead.setOuterRadiusAutomatic(false);
        bulkhead.setOuterRadius(0.031);
        bulkhead.setMaterial(PLYWOOD);
        bulkhead.setAxialMethod(AxialMethod.TOP);
        bulkhead.setAxialOffset(0.250);
        body.addChild(bulkhead);

        body.addChild(parachute("Main parachute", 0.280, 0.120, 0.030, 0.100, 0.900));

        InnerTube mount = new InnerTube();
        mount.setName("Motor mount tube (38 mm)");
        mount.setLength(0.200);
        mount.setOuterRadius(0.0195);
        mount.setThickness(0.0015);
        mount.setMaterial(PAPER);
        mount.setAxialMethod(AxialMethod.TOP);
        mount.setAxialOffset(0.600);
        mount.setMotorMount(true);
        mount.setMotorOverhang(0.0);
        body.addChild(mount);

        for (double x : new double[] {0.610, 0.784}) {
            CenteringRing ring = new CenteringRing();
            ring.setName("Centering ring at " + x);
            ring.setLength(0.006);
            ring.setOuterRadius(0.031);
            ring.setInnerRadius(0.0195);
            ring.setMaterial(PLYWOOD);
            ring.setAxialMethod(AxialMethod.TOP);
            ring.setAxialOffset(x);
            body.addChild(ring);
        }

        TrapezoidFinSet fins = new TrapezoidFinSet(4, 0.150, 0.060, 0.090, 0.080);
        fins.setName("Fins (4)");
        fins.setThickness(0.004);
        fins.setCrossSection(FinSet.CrossSection.SQUARE);
        fins.setMaterial(PLYWOOD);
        fins.setFinish(ExternalComponent.Finish.NORMAL);
        fins.setAxialMethod(AxialMethod.BOTTOM);
        fins.setAxialOffset(0.0);
        body.addChild(fins);

        body.addChild(railButtons("Rail buttons (2)", 0.400, 0.350, 0.010, 0.006, 0.010, 0.002, 0.002));

        rocket.setSelectedConfiguration(fcid);
        rocket.enableEvents();
        return new Spec("r4-scratch-38mm", "AeroTech_H123W.eng", "H123W", 10.0, rocket, fcid);
    }

    /** R5: 29 mm minimum-diameter fiberglass rocket intended to fly transonic, AeroTech H238T-6. */
    static Spec rocket5() {
        Rocket rocket = new Rocket();
        rocket.setName("r5-transonic-min-dia-29");
        FlightConfigurationId fcid = new FlightConfigurationId();
        rocket.createFlightConfiguration(fcid);
        AxialStage stage = new AxialStage();
        stage.setName("Sustainer");
        rocket.addChild(stage);

        NoseCone nose = new NoseCone(Transition.Shape.HAACK, 0.130, 0.016);
        nose.setName("Nose cone (Von Karman, LD-Haack)");
        nose.setShapeParameter(0.0);
        nose.setFilled(false);
        nose.setThickness(0.002);
        nose.setMaterial(FIBERGLASS);
        nose.setFinish(ExternalComponent.Finish.NORMAL);
        nose.setAftShoulderLength(0.030);
        nose.setAftShoulderRadius(0.0145);
        nose.setAftShoulderThickness(0.0015);
        stage.addChild(nose);

        BodyTube body = new BodyTube(0.550, 0.016, 0.0015);
        body.setName("Body tube (motor mount)");
        body.setMaterial(FIBERGLASS);
        body.setFinish(ExternalComponent.Finish.NORMAL);
        body.setMotorMount(true);
        body.setMotorOverhang(0.0);
        stage.addChild(body);

        TrapezoidFinSet fins = new TrapezoidFinSet(3, 0.075, 0.025, 0.050, 0.035);
        fins.setName("Fins (3)");
        fins.setThickness(0.002);
        fins.setCrossSection(FinSet.CrossSection.SQUARE);
        fins.setMaterial(FIBERGLASS);
        fins.setFinish(ExternalComponent.Finish.NORMAL);
        fins.setAxialMethod(AxialMethod.BOTTOM);
        fins.setAxialOffset(0.0);
        body.addChild(fins);

        body.addChild(railButtons("Rail buttons (2)", 0.250, 0.250, 0.008, 0.004, 0.008, 0.0015, 0.0015));
        body.addChild(mass("Nose weight", 0.000, 0.040, 0.012, 0.040));
        body.addChild(parachute("Parachute", 0.060, 0.100, 0.014, 0.020, 0.350));

        rocket.setSelectedConfiguration(fcid);
        rocket.enableEvents();
        return new Spec("r5-transonic-min-dia-29", "AeroTech_H238T.eng", "H238T", 6.0, rocket, fcid);
    }

    // ----- component helpers -----

    static Parachute parachute(String name, double top, double length, double radius, double massKg, double diameter) {
        Parachute chute = new Parachute();
        chute.setName(name);
        chute.setAxialMethod(AxialMethod.TOP);
        chute.setAxialOffset(top);
        chute.setLength(length);
        chute.setRadiusAutomatic(false);
        chute.setRadius(radius);
        chute.setOverrideMass(massKg);
        chute.setMassOverridden(true);
        chute.setDiameter(diameter);
        chute.setCDAutomatic(false);
        chute.setCD(0.8);
        DeploymentConfiguration deploy = chute.getDeploymentConfigurations().getDefault();
        deploy.setDeployEvent(DeploymentConfiguration.DeployEvent.APOGEE);
        deploy.setDeployDelay(0.0);
        return chute;
    }

    static MassComponent mass(String name, double top, double length, double radius, double massKg) {
        MassComponent m = new MassComponent();
        m.setName(name);
        m.setAxialMethod(AxialMethod.TOP);
        m.setAxialOffset(top);
        m.setLength(length);
        m.setRadiusAutomatic(false);
        m.setRadius(radius);
        m.setComponentMass(massKg);
        return m;
    }

    static RailButton railButtons(String name, double top, double separation, double outerDiameter, double innerDiameter,
                                  double totalHeight, double baseHeight, double flangeHeight) {
        RailButton rb = new RailButton();
        rb.setName(name);
        rb.setAxialMethod(AxialMethod.TOP);
        rb.setAxialOffset(top);
        rb.setInstanceCount(2);
        rb.setInstanceSeparation(separation);
        rb.setOuterDiameter(outerDiameter);
        rb.setInnerDiameter(innerDiameter);
        rb.setTotalHeight(totalHeight);
        rb.setBaseHeight(baseHeight);
        rb.setFlangeHeight(flangeHeight);
        rb.setScrewHeight(0.0);
        rb.setMaterial(NYLON);
        rb.setFinish(ExternalComponent.Finish.NORMAL);
        return rb;
    }

    // ----- processing -----

    static Motor loadMotor(File motorDir, String fileName, String designation) throws IOException {
        File f = new File(motorDir, fileName);
        List<ThrustCurveMotor.Builder> builders;
        try (FileInputStream in = new FileInputStream(f)) {
            builders = new GeneralMotorLoader().load(in, f.getName());
        }
        if (builders.size() != 1) {
            throw new IllegalStateException(fileName + " contains " + builders.size() + " motors, expected 1");
        }
        ThrustCurveMotor motor = builders.get(0).build();
        if (!motor.getDesignation().equals(designation)) {
            throw new IllegalStateException(fileName + " designation is '" + motor.getDesignation() + "', expected '" + designation + "'");
        }
        return motor;
    }

    static MotorMount findMount(Rocket rocket) {
        for (RocketComponent c : rocket) {
            if (c instanceof MotorMount && ((MotorMount) c).isMotorMount()) {
                return (MotorMount) c;
            }
        }
        throw new IllegalStateException("no motor mount");
    }

    static void processRocket(Spec spec, File motorDir, File outDir, PrintWriter values, double gravity) throws Exception {
        System.out.println("=== " + spec.name + " ===");
        Rocket rocket = spec.rocket;
        Motor motor = loadMotor(motorDir, spec.motorFile, spec.motorDesignation);
        MotorMount mount = findMount(rocket);
        MotorConfiguration motorConfig = new MotorConfiguration(mount, spec.fcid);
        motorConfig.setMotor(motor);
        motorConfig.setEjectionDelay(spec.ejectionDelay);
        mount.setMotorConfig(motorConfig, spec.fcid);
        rocket.setSelectedConfiguration(spec.fcid);
        FlightConfiguration config = rocket.getFlightConfiguration(spec.fcid);
        config.setAllStages();

        // --- Stability exactly as the OpenRocket design window computes it ---
        FlightConditions conditions = new FlightConditions(config);
        conditions.setMach(STABILITY_MACH);
        conditions.setAOA(STABILITY_AOA);
        conditions.setRollRate(0.0);
        WarningSet warnings = new WarningSet();
        AerodynamicCalculator aero = new BarrowmanCalculator();
        Coordinate cp = aero.getWorstCP(config, conditions, warnings);
        RigidBody launch = MassCalculator.calculateLaunch(config);
        RigidBody burnout = MassCalculator.calculateBurnout(config);
        RigidBody structure = MassCalculator.calculateStructure(config);
        RigidBody motorBody = MassCalculator.calculateMotor(config);
        double refLength = config.getReferenceLength();
        double cgx = launch.getCM().x;
        double stability = (cp.x - cgx) / refLength;
        System.out.printf("  ref length %.4f m, CG(launch) %.6f m, CG(burnout) %.6f m, CP %.6f m, stability %.4f cal%n",
                refLength, cgx, burnout.getCM().x, cp.x, stability);
        System.out.printf("  mass: launch %.6f kg, burnout %.6f kg, structure %.6f kg, motor %.6f kg at x=%.6f m%n",
                launch.getMass(), burnout.getMass(), structure.getMass(), motorBody.getMass(), motorBody.getCM().x);
        System.out.println("  CP warnings: " + warnings);

        writeComponents(spec, config, outDir, motorBody);

        OpenRocketDocument doc = OpenRocketDocumentFactory.createDocumentFromRocket(rocket);

        for (double wind : WIND_SPEEDS) {
            FlightData first = null;
            Simulation keep = null;
            for (int run = 0; run < 2; run++) {
                Simulation sim = new Simulation(doc, rocket);
                sim.setName(String.format("%s wind %.0f m/s run %d", spec.name, wind, run + 1));
                sim.setFlightConfigurationId(spec.fcid);
                configure(sim.getOptions(), wind);
                sim.simulate();
                FlightData data = sim.getSimulatedData();
                if (run == 0) {
                    first = data;
                    keep = sim;
                } else {
                    boolean same = first.getMaxAltitude() == data.getMaxAltitude()
                            && first.getMaxVelocity() == data.getMaxVelocity()
                            && first.getLaunchRodVelocity() == data.getLaunchRodVelocity()
                            && first.getTimeToApogee() == data.getTimeToApogee()
                            && first.getFlightTime() == data.getFlightTime();
                    System.out.printf("  wind %.0f m/s: repeat run identical = %s%n", wind, same);
                    if (!same) {
                        throw new IllegalStateException("Simulation is not deterministic for " + spec.name);
                    }
                }
            }
            doc.addSimulation(keep);
            FlightData d = first;
            System.out.printf("  wind %.0f m/s: apogee %.3f m, max v %.3f m/s, rail exit %.3f m/s, max Mach %.4f, t_apogee %.3f s, warnings %s%n",
                    wind, d.getMaxAltitude(), d.getMaxVelocity(), d.getLaunchRodVelocity(), d.getMaxMachNumber(), d.getTimeToApogee(), d.getWarningSet());
            String warn = d.getWarningSet().toString().replace(',', ';').replace('\n', ' ');
            values.printf(Locale.US, "%s.ork,%s,%s,%.1f,%.6f,%.6f,%.4f,%.3f,%.3f,%.3f,%.1f,%.1f,%.1f,%.4f,%.6f,%.6f,%.6f,%.4f,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,\"%s\"%n",
                    spec.name, spec.motorDesignation, OR_VERSION, STABILITY_MACH, cgx, cp.x, stability,
                    d.getMaxAltitude(), d.getMaxVelocity(), d.getLaunchRodVelocity(), LAUNCH_ROD_LENGTH, wind, SITE_ALTITUDE,
                    refLength, launch.getMass(), burnout.getMass(), burnout.getCM().x, d.getMaxMachNumber(), d.getMaxAcceleration(),
                    d.getTimeToApogee(), d.getFlightTime(), d.getDeploymentVelocity(), d.getGroundHitVelocity(), TIME_STEP, warn);
            writeTimeSeries(spec, wind, d.getBranch(0), outDir);
        }

        File ork = new File(outDir, spec.name + ".ork");
        new GeneralRocketSaver().save(ork, doc);
        System.out.println("  saved " + ork);
    }

    static void configure(SimulationOptions o, double wind) {
        o.setLaunchRodLength(LAUNCH_ROD_LENGTH);
        o.setLaunchRodAngle(LAUNCH_ROD_ANGLE);
        o.setLaunchIntoWind(false);
        o.setLaunchRodDirection(LAUNCH_ROD_DIRECTION);
        o.setLaunchAltitude(SITE_ALTITUDE);
        o.setLaunchLatitude(SITE_LATITUDE);
        o.setLaunchLongitude(SITE_LONGITUDE);
        o.setGeodeticComputation(GeodeticComputationStrategy.FLAT);
        o.setISAAtmosphere(true);
        o.setTimeStep(TIME_STEP);
        o.setMaxSimulationTime(MAX_SIM_TIME);
        o.setRandomSeed(RANDOM_SEED);
        o.setWindModelType(info.openrocket.core.models.wind.WindModelType.AVERAGE);
        o.getAverageWindModel().setAverage(wind);
        o.getAverageWindModel().setTurbulenceIntensity(WIND_TURBULENCE);
        o.getAverageWindModel().setDirection(WIND_DIRECTION);
    }

    static void writeComponents(Spec spec, FlightConfiguration config, File outDir, RigidBody motorBody) throws IOException {
        File f = new File(new File(outDir, "components"), spec.name + ".csv");
        try (PrintWriter w = new PrintWriter(f)) {
            w.println("component,type,mass_kg_all_instances,length_m,position_x_m,cg_x_abs_m,cg_x_rel_m,instances");
            for (RocketComponent c : spec.rocket) {
                if (c instanceof Rocket || c instanceof AxialStage) continue;
                Coordinate[] locs = c.getComponentLocations();
                Coordinate cg = c.getComponentCG();
                double x0 = locs.length > 0 ? locs[0].x : Double.NaN;
                w.printf(Locale.US, "\"%s\",%s,%.6f,%.6f,%.6f,%.6f,%.6f,%d%n", c.getName(), c.getClass().getSimpleName(),
                        c.getMass(), c.getLength(), x0, x0 + cg.x, cg.x, c.getInstanceCount());
            }
            w.printf(Locale.US, "\"Motor (%s) at launch\",Motor,%.6f,,,%.6f,,1%n", spec.motorDesignation, motorBody.getMass(), motorBody.getCM().x);
        }
    }

    static void writeTimeSeries(Spec spec, double wind, FlightDataBranch branch, File outDir) throws IOException {
        File f = new File(new File(outDir, "timeseries"), String.format(Locale.US, "%s-wind%.0f.csv", spec.name, wind));
        FlightDataType[] types = {FlightDataType.TYPE_TIME, FlightDataType.TYPE_ALTITUDE, FlightDataType.TYPE_VELOCITY_Z,
                FlightDataType.TYPE_VELOCITY_TOTAL, FlightDataType.TYPE_ACCELERATION_TOTAL, FlightDataType.TYPE_MACH_NUMBER,
                FlightDataType.TYPE_THRUST_FORCE, FlightDataType.TYPE_DRAG_FORCE, FlightDataType.TYPE_DRAG_COEFF, FlightDataType.TYPE_MASS,
                FlightDataType.TYPE_CG_LOCATION, FlightDataType.TYPE_CP_LOCATION, FlightDataType.TYPE_STABILITY, FlightDataType.TYPE_AOA,
                FlightDataType.TYPE_POSITION_X, FlightDataType.TYPE_POSITION_Y};
        String[] names = {"time_s", "altitude_m", "velocity_z_ms", "velocity_total_ms", "acceleration_total_ms2", "mach", "thrust_n",
                "drag_n", "drag_coefficient", "mass_kg", "cg_m", "cp_m", "stability_cal", "aoa_rad", "position_x_m", "position_y_m"};
        List<List<Double>> cols = new ArrayList<>();
        for (FlightDataType t : types) cols.add(branch.get(t));
        int n = cols.get(0).size();
        try (PrintWriter w = new PrintWriter(f)) {
            w.println(String.join(",", names));
            for (int i = 0; i < n; i++) {
                StringBuilder sb = new StringBuilder();
                for (int k = 0; k < cols.size(); k++) {
                    if (k > 0) sb.append(',');
                    List<Double> col = cols.get(k);
                    Double v = (col != null && i < col.size()) ? col.get(i) : null;
                    sb.append(v == null ? "" : String.format(Locale.US, "%.6g", v));
                }
                w.println(sb);
            }
        }
    }
}
