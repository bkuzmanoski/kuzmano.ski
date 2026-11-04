import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import LookingDownLeftAvatar from "#/assets/images/avatar-looking-down-left.svg?react";
import LookingDownRightAvatar from "#/assets/images/avatar-looking-down-right.svg?react";
import LookingUpLeftAvatar from "#/assets/images/avatar-looking-up-left.svg?react";
import LookingUpRightAvatar from "#/assets/images/avatar-looking-up-right.svg?react";
import { TOUCH_PRESS_INIT } from "#/test-utils/press.ts";

import { Avatar } from "./avatar.tsx";

import type { ComponentType } from "react";

/** A point on each side of the center of the avatar that `renderAvatarLaidOut` lays out, which is at 134, 134. */
const ABOVE_OR_LEFT_OF_CENTER_PX = 120;
const BELOW_OR_RIGHT_OF_CENTER_PX = 150;

const avatar = () => screen.getByRole("img", { name: "A name" });
const renderAvatarLaidOut = () => {
  render(<Avatar alt="A name" />);
  vi.spyOn(avatar(), "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 68, 68));
};
const shownSpriteMarkup = () => avatar().querySelector("svg")!.innerHTML;
const spriteMarkupOf = (Sprite: ComponentType) => {
  const { container, unmount } = render(<Sprite />);
  const markup = container.querySelector("svg")!.innerHTML;

  unmount();

  return markup;
};

describe("Avatar", () => {
  test("renders an image named by its `alt` prop", () => {
    render(<Avatar alt="A name" />);
    expect(screen.queryByRole("img", { name: "A name" })).not.toBeNull();
  });

  test("hides its sprite from assistive technology", () => {
    renderAvatarLaidOut();
    expect(avatar().querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  test.each([
    {
      direction: "up and to the left",
      position: "above and to the left",
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
      Sprite: LookingUpLeftAvatar,
      OppositeSprite: LookingDownRightAvatar,
    },
    {
      direction: "up and to the right",
      position: "above and to the right",
      clientX: BELOW_OR_RIGHT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
      Sprite: LookingUpRightAvatar,
      OppositeSprite: LookingDownLeftAvatar,
    },
    {
      direction: "down and to the left",
      position: "below and to the left",
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: BELOW_OR_RIGHT_OF_CENTER_PX,
      Sprite: LookingDownLeftAvatar,
      OppositeSprite: LookingUpRightAvatar,
    },
    {
      direction: "down and to the right",
      position: "below and to the right",
      clientX: BELOW_OR_RIGHT_OF_CENTER_PX,
      clientY: BELOW_OR_RIGHT_OF_CENTER_PX,
      Sprite: LookingDownRightAvatar,
      OppositeSprite: LookingUpLeftAvatar,
    },
  ])(
    "renders the sprite looking $direction after a pointer moves $position of the center of the avatar",
    ({ clientX, clientY, Sprite, OppositeSprite }) => {
      const oppositeClientX = ABOVE_OR_LEFT_OF_CENTER_PX + BELOW_OR_RIGHT_OF_CENTER_PX - clientX;
      const oppositeClientY = ABOVE_OR_LEFT_OF_CENTER_PX + BELOW_OR_RIGHT_OF_CENTER_PX - clientY;

      renderAvatarLaidOut();
      fireEvent.pointerMove(document, { clientX: oppositeClientX, clientY: oppositeClientY });

      expect(shownSpriteMarkup()).toBe(spriteMarkupOf(OppositeSprite));

      fireEvent.pointerMove(document, { clientX, clientY });

      expect(shownSpriteMarkup()).toBe(spriteMarkupOf(Sprite));
    },
  );

  test("renders the sprite looking up and to the left after a touch press above and to the left of the center of the avatar", () => {
    renderAvatarLaidOut();
    fireEvent.pointerDown(document, {
      ...TOUCH_PRESS_INIT,
      clientX: ABOVE_OR_LEFT_OF_CENTER_PX,
      clientY: ABOVE_OR_LEFT_OF_CENTER_PX,
    });

    expect(shownSpriteMarkup()).toBe(spriteMarkupOf(LookingUpLeftAvatar));
  });
});
