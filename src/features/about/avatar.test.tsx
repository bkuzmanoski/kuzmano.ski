import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, test, vi } from "vitest";

import { TOUCH_PRESS_INIT } from "#/test-utils/press.ts";

import styles from "./avatar.module.css";
import { Avatar } from "./avatar.tsx";

const SPEECH = "A line of speech.";

const GRAPHIC_RECT = new DOMRect(100, 100, 68, 68);
const GRAPHIC_CENTER_PX = GRAPHIC_RECT.x + GRAPHIC_RECT.width / 2;
const ABOVE_OR_LEFT_OF_CENTER_PX = GRAPHIC_CENTER_PX - 16;
const BELOW_OR_RIGHT_OF_CENTER_PX = GRAPHIC_CENTER_PX + 16;

const graphic = () => screen.getByRole("img");
const renderAvatarLaidOut = () => {
  render(<Avatar />);
  vi.spyOn(graphic(), "getBoundingClientRect").mockReturnValue(GRAPHIC_RECT);
};
const gazeDirection = () => graphic().getAttribute("data-gaze-direction");
const speechBubbleIn = (container: HTMLElement) => container.querySelector<HTMLElement>(`.${styles.speechBubble}`);
const renderAvatarWithSpeech = () => speechBubbleIn(render(<Avatar speech={SPEECH} />).container)!;

describe("Avatar", () => {
  test("attaches the `graphicRef` prop to the graphic", () => {
    const graphicRef = createRef<SVGSVGElement>();

    render(<Avatar graphicRef={graphicRef} />);

    expect(graphicRef.current).toBe(graphic());
  });

  test("adds the `className` prop to the class of its root", () => {
    const { container } = render(<Avatar className="fixture-class" />);
    const root = container.firstElementChild;

    expect(root?.classList).toContain("fixture-class");
    expect(root?.classList).toContain(styles.avatar);
  });

  test("renders the `speech` prop in a speech bubble", () => {
    expect(renderAvatarWithSpeech().textContent).toBe(SPEECH);
  });

  test("describes the graphic with the `speech` prop", () => {
    render(<Avatar speech={SPEECH} />);
    expect(screen.queryByRole("img", { description: SPEECH })).not.toBeNull();
  });

  test("hides the speech bubble from assistive technology", () => {
    expect(renderAvatarWithSpeech().getAttribute("aria-hidden")).toBe("true");
  });

  test("omits the speech bubble when the `speech` prop is unset", () => {
    const { container } = render(<Avatar />);
    expect(speechBubbleIn(container)).toBeNull();
  });

  test("shows the speech bubble while a mouse pointer is over the graphic", () => {
    const speechBubble = renderAvatarWithSpeech();

    expect(speechBubble.hasAttribute("data-shown")).toBe(false);

    fireEvent.pointerEnter(graphic(), { pointerType: "mouse" });

    expect(speechBubble.hasAttribute("data-shown")).toBe(true);

    fireEvent.pointerLeave(graphic(), { pointerType: "mouse" });

    expect(speechBubble.hasAttribute("data-shown")).toBe(false);
  });

  test("shows the speech bubble from a touch press on the graphic until a press outside it", () => {
    const speechBubble = renderAvatarWithSpeech();

    fireEvent.pointerDown(graphic(), TOUCH_PRESS_INIT);
    fireEvent.pointerUp(graphic(), TOUCH_PRESS_INIT);
    fireEvent.pointerLeave(graphic(), TOUCH_PRESS_INIT);

    expect(speechBubble.hasAttribute("data-shown")).toBe(true);

    fireEvent.pointerDown(graphic(), TOUCH_PRESS_INIT);

    expect(speechBubble.hasAttribute("data-shown")).toBe(true);

    fireEvent.pointerDown(document.body, TOUCH_PRESS_INIT);

    expect(speechBubble.hasAttribute("data-shown")).toBe(false);
  });

  test("renders the graphic outside the tab order", () => {
    render(<Avatar speech={SPEECH} />);
    expect(graphic().tabIndex).toBe(-1);
  });

  test.each([
    {
      position: "above and to the left",
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
      expectedGazeDirection: "up-left",
      oppositeGazeDirection: "down-right",
    },
    {
      position: "above and to the right",
      clientX: BELOW_OR_RIGHT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
      expectedGazeDirection: "up-right",
      oppositeGazeDirection: "down-left",
    },
    {
      position: "below and to the left",
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: BELOW_OR_RIGHT_OF_CENTER_PX,
      expectedGazeDirection: "down-left",
      oppositeGazeDirection: "up-right",
    },
    {
      position: "below and to the right",
      clientX: BELOW_OR_RIGHT_OF_CENTER_PX,
      clientY: BELOW_OR_RIGHT_OF_CENTER_PX,
      expectedGazeDirection: "down-right",
      oppositeGazeDirection: "up-left",
    },
  ])(
    "sets the `data-gaze-direction` attribute of the graphic to `$expectedGazeDirection` after a pointer moves $position of the graphic's center",
    ({ clientX, clientY, expectedGazeDirection, oppositeGazeDirection }) => {
      const oppositeClientX = ABOVE_OR_LEFT_OF_CENTER_PX + BELOW_OR_RIGHT_OF_CENTER_PX - clientX;
      const oppositeClientY = ABOVE_OR_LEFT_OF_CENTER_PX + BELOW_OR_RIGHT_OF_CENTER_PX - clientY;

      renderAvatarLaidOut();
      fireEvent.pointerMove(document, { clientX: oppositeClientX, clientY: oppositeClientY });

      expect(gazeDirection()).toBe(oppositeGazeDirection);

      fireEvent.pointerMove(document, { clientX, clientY });

      expect(gazeDirection()).toBe(expectedGazeDirection);
    },
  );

  test("sets the `data-gaze-direction` attribute of the graphic to `up-left` after a touch press above and to the left of the graphic's center", () => {
    renderAvatarLaidOut();
    fireEvent.pointerDown(document, {
      ...TOUCH_PRESS_INIT,
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
    });

    expect(gazeDirection()).toBe("up-left");
  });
});
