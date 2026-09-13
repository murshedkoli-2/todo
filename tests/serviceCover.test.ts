import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { TASK_SERVICES } from "@/lib/serviceCatalogue";
import { SERVICE_ICONS, ServiceIcon } from "@/components/ui/ServiceIcon";
import TaskCover, { DEFAULT_TASK_COVER } from "@/components/ui/TaskCover";

describe("service icons", () => {
  test("every catalogue service has a dedicated icon", () => {
    for (const service of TASK_SERVICES) {
      expect(SERVICE_ICONS[service]).toBeDefined();
      expect(typeof SERVICE_ICONS[service]).toBe("function");
    }
  });

  test("ServiceIcon component renders correctly for every service", () => {
    for (const service of TASK_SERVICES) {
      const element = ServiceIcon({ service });
      expect(element).toBeDefined();
      expect(element.type).toBe(SERVICE_ICONS[service]);
    }
  });
});

describe("static service feature cover images", () => {
  test("every catalogue service has a 1200x630 vector SVG banner in public/services/", () => {
    for (const service of TASK_SERVICES) {
      const filePath = join(process.cwd(), "public", "services", `${service}.svg`);
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf8");
      expect(content).toContain("<svg");
      expect(content).toContain('viewBox="0 0 1200 630"');
      expect(content).toContain("</svg>");
    }
  });
});

describe("TaskCover logic", () => {
  test("uses uploaded src when provided", () => {
    const element = TaskCover({ src: "https://example.com/cover.jpg" });
    expect(element).toBeDefined();
    // Image child receives the uploaded src
    expect(element.props.children.props.src).toBe("https://example.com/cover.jpg");
  });

  test("uses default task cover when no src and no services are provided", () => {
    const element = TaskCover({ src: null, services: [] });
    expect(element).toBeDefined();
    expect(element.props.children.props.src).toBe(DEFAULT_TASK_COVER);
  });

  test("uses single service vector SVG cover when exactly 1 service is present", () => {
    const element = TaskCover({ src: null, services: ["new_passport"] });
    expect(element).toBeDefined();
    expect(element.props.children.props.src).toBe("/services/new_passport.svg");
  });

  test("renders multi-service composite cover when multiple services are present", () => {
    const element = TaskCover({
      src: null,
      services: ["new_passport", "bmet_registration"],
    });
    expect(element).toBeDefined();
    // The child is the MultiServiceCover component
    const multiCover = element.props.children;
    expect(multiCover.props.services).toEqual(["new_passport", "bmet_registration"]);
  });
});
