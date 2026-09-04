import { act, render, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { createClientStore } from "./client-store.ts";

// The contract is about which snapshot React takes when, so the hook needs a real render to observe.
function createStoreProbe(serverValue: string, read: () => string) {
  const store = createClientStore(serverValue, read);
  const Probe = () => <output>{store.useValue()}</output>;

  return { ...store, Probe };
}

const probeText = (container: HTMLElement) =>
  within(container)
    .getAllByRole("status")
    .map((element) => element.textContent);

describe("getValue", () => {
  test("reads the client value on the first call and reuses it afterwards", () => {
    const read = vi.fn(() => "client");
    const { getValue } = createClientStore("server", read);

    expect(read).not.toHaveBeenCalled(); // Creating the store must not read client-only state.
    expect(getValue()).toBe("client");
    expect(getValue()).toBe("client");
    expect(read).toHaveBeenCalledOnce();
  });

  test("does not overwrite a value set before the first read", () => {
    const read = vi.fn(() => "client");
    const { getValue, setValue } = createClientStore("server", read);

    setValue("set");

    expect(getValue()).toBe("set");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("useValue", () => {
  test("renders the server value on the server, without reading", () => {
    const read = vi.fn(() => "client");
    const { Probe } = createStoreProbe("server", read);

    expect(renderToString(<Probe />)).toBe("<output>server</output>");
    expect(read).not.toHaveBeenCalled();
  });

  test("hydrates against the server markup, then re-renders with the client value", () => {
    const { Probe } = createStoreProbe("server", () => "client");
    const container = document.createElement("div");

    container.innerHTML = renderToString(<Probe />);
    document.body.append(container);

    // A hydration pass that took the client snapshot would render "client" over
    // markup containing "server", which React recovers from and reports here.
    const onRecoverableError = vi.fn();

    act(() => {
      hydrateRoot(container, <Probe />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("client");

    container.remove(); // Testing Library's cleanup only removes the containers it created.
  });

  test("re-renders every component reading the value when it is set", () => {
    const { Probe, setValue } = createStoreProbe("server", () => "client");
    const { container } = render(
      <>
        <Probe />
        <Probe />
      </>,
    );

    expect(probeText(container)).toEqual(["client", "client"]);

    act(() => setValue("next"));

    expect(probeText(container)).toEqual(["next", "next"]);
  });
});
