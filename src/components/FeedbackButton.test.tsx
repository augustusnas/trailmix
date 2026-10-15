import { render, screen } from "@testing-library/react";
import { FeedbackButton } from "./FeedbackButton";

describe("Send beta feedback button", () => {
  it("hides when FEEDBACK_EMAIL is not set", () => {
    const { container } = render(<FeedbackButton email={undefined} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/send beta feedback/i)).toBeNull();
  });

  it("hides when FEEDBACK_EMAIL is empty", () => {
    const { container } = render(<FeedbackButton email="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a pre-filled email when the address is set", () => {
    render(<FeedbackButton email="beta@example.com" />);
    const link = screen.getByRole("link", { name: /send beta feedback/i });
    const href = link.getAttribute("href")!;
    expect(href.startsWith("mailto:beta@example.com?")).toBe(true);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Trailmix beta feedback");
    const body = params.get("body")!;
    expect(body).toMatch(/App version: /);
    expect(body).toMatch(/Device: /);
    expect(body).toMatch(/Music app: /);
  });
});
