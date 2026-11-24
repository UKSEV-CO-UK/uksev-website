import { test } from "node:test";
import assert from "node:assert/strict";
import { coverPhoto, galleryPhotos, type Colour, type Photo } from "../src/lib/newbikes-types";

const p = (src: string): Photo => ({ src });
const colour = (name: string, srcs: string[]): Colour => ({
  name,
  photos: srcs.map(p),
});

test("galleryPhotos: colour photos in listed order, then general photos", () => {
  const b = {
    colours: [colour("Grey", ["/c/grey-1.webp", "/c/grey-2.webp"]), colour("Black", ["/c/black-1.webp"])],
    photos: [p("/g/side.webp"), p("/g/detail.webp")],
  };
  assert.deepEqual(
    galleryPhotos(b).map((x) => x.src),
    ["/c/grey-1.webp", "/c/grey-2.webp", "/c/black-1.webp", "/g/side.webp", "/g/detail.webp"],
  );
});

test("galleryPhotos: selected colour moves to the front; other colours keep their order", () => {
  const b = {
    colours: [
      colour("Grey", ["/c/grey-1.webp"]),
      colour("Black", ["/c/black-1.webp", "/c/black-2.webp"]),
      colour("White", ["/c/white-1.webp"]),
    ],
    photos: [p("/g/side.webp")],
  };
  assert.deepEqual(
    galleryPhotos(b, "Black").map((x) => x.src),
    ["/c/black-1.webp", "/c/black-2.webp", "/c/grey-1.webp", "/c/white-1.webp", "/g/side.webp"],
  );
});

test("galleryPhotos: an unknown selected colour is ignored", () => {
  const b = {
    colours: [colour("Grey", ["/c/grey-1.webp"]), colour("Black", ["/c/black-1.webp"])],
    photos: [p("/g/side.webp")],
  };
  assert.deepEqual(
    galleryPhotos(b, "Red").map((x) => x.src),
    ["/c/grey-1.webp", "/c/black-1.webp", "/g/side.webp"],
  );
});

test("galleryPhotos: identical src values are kept once, at first position", () => {
  const shared = "/c/grey-1.webp";
  const b = {
    colours: [colour("Grey", [shared, "/c/grey-2.webp"]), colour("Black", [shared, "/c/black-1.webp"])],
    photos: [p(shared), p("/g/side.webp"), p("/g/side.webp")],
  };
  assert.deepEqual(
    galleryPhotos(b).map((x) => x.src),
    [shared, "/c/grey-2.webp", "/c/black-1.webp", "/g/side.webp"],
  );
});

test("galleryPhotos: no colours uses general photos only", () => {
  const b = { colours: [] as Colour[], photos: [p("/g/a.webp"), p("/g/b.webp"), p("/g/a.webp")] };
  assert.deepEqual(
    galleryPhotos(b).map((x) => x.src),
    ["/g/a.webp", "/g/b.webp"],
  );
});

test("galleryPhotos: no general photos uses colour photos only", () => {
  const b = {
    colours: [colour("Grey", ["/c/grey-1.webp"]), colour("Black", ["/c/black-1.webp"])],
    photos: [] as Photo[],
  };
  assert.deepEqual(
    galleryPhotos(b).map((x) => x.src),
    ["/c/grey-1.webp", "/c/black-1.webp"],
  );
});

test("galleryPhotos: empty listing yields an empty list", () => {
  assert.deepEqual(galleryPhotos({ colours: [], photos: [] }), []);
});

test("coverPhoto is unchanged: first colour's first photo, else first general photo", () => {
  const withColour = {
    colours: [colour("Grey", ["/c/grey-1.webp", "/c/grey-2.webp"]), colour("Black", ["/c/black-1.webp"])],
    photos: [p("/g/side.webp")],
  };
  assert.equal(coverPhoto(withColour)?.src, "/c/grey-1.webp");
  assert.equal(coverPhoto(withColour, "Black")?.src, "/c/black-1.webp");
  const generalOnly = { colours: [] as Colour[], photos: [p("/g/side.webp")] };
  assert.equal(coverPhoto(generalOnly)?.src, "/g/side.webp");
});
