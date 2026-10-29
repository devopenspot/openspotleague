"use client";

/* eslint-disable react-hooks/set-state-in-effect -- intentional dependent state resets for spot/weather eligibility */
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { Overlay } from "@/components/feedback/Overlay";
import { GameTransitionLoader } from "@/components/feedback/GameTransitionLoader";
import { useDistanceUnit } from "@/hooks/preferences/useDistanceUnit";
import { useUserLocation } from "@/hooks/map/useUserLocation";
import { useTemperatureUnit } from "@/hooks/preferences/useTemperatureUnit";
import { useSpotWeather } from "@/hooks/data/useSpotWeather";
import { haversineMeters } from "@/lib/spots/geo";
import {
  gameCreationOptionsSchema,
  gameMutationResponseSchema,
  type GameCreationOptions,
  type GameMode,
  type RuleMode,
  type TrickLevel,
} from "@/lib/schemas/game";
import { SpotSchema } from "@/lib/schemas/spot";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";
import {
  type FieldName,
  type FieldErrors,
  type GameSetupStep,
  type ChallengeStartDelay,
  GAME_CREATE_FORM_ID,
  GAME_SETTINGS_ANCHOR_ID,
  CHALLENGE_START_OPTIONS,
  GuestNicknameField,
  OptionChip,
  GameFormatSettings,
  CategoriesField,
  SetupProgress,
  ChallengeTimeStep,
  ChallengeSpotStep,
  WeatherConfirmSection,
  ConfigurationSummary,
  CreateSubmitButton,
  FieldError,
} from "./form-parts";

import type { Spot, WeatherIconName } from "@/lib/types";
import {
  DISCIPLINE_TO_SPORT,
  resolveGameDiscipline,
  type DisciplineSlug,
} from "@/lib/games/discipline";
import { loadOrCreateGuestToken, normalizeGuestName } from "@/lib/games/guest";
import {
  computeLevelsForSpotAndCategories,
  countEligibleTricks,
  countTricksPerCategory,
  countTricksPerLevel,
} from "./trick-catalog-filters";
import { usePreferencesStore } from "@/stores/preferences-store";
import type { GamePrefill } from "@/lib/games/prefill";

const GAME_SETUP_DIALOG_ID = "game-setup-dialog";
const GAME_SETUP_TITLE_ID = "game-setup-title";
const GAME_SETUP_DESCRIPTION_ID = "game-setup-description";

const GUEST_NICKNAME_SETUP_ID = "guest-nickname-setup";
const GUEST_NAME_STORAGE_KEY = "openspot-guest-name";
const CHALLENGE_SETUP_STEPS = [
  { id: "settings", label: "Player", title: "Who & how you play" },
  { id: "trick", label: "Trick", title: "Pick spot, level & categories" },
  { id: "time", label: "Time", title: "When the lobby opens" },
  { id: "spot", label: "Spot", title: "Verify the spot" },
  { id: "confirm", label: "Confirm", title: "Weather & summary" },
] as const satisfies ReadonlyArray<{
  id: GameSetupStep;
  label: string;
  title: string;
}>;
const TRAINING_SETUP_STEPS = [
  { id: "settings", label: "Player", title: "Who & how you play" },
  { id: "trick", label: "Trick", title: "Pick spot, level & categories" },
  { id: "spot", label: "Spot", title: "Choose where to record" },
  { id: "confirm", label: "Confirm", title: "Weather & summary" },
] as const satisfies ReadonlyArray<{
  id: GameSetupStep;
  label: string;
  title: string;
}>;

function moveRadioFocus(
  event: KeyboardEvent<HTMLButtonElement>,
  ids: string[],
  currentIndex: number,
  select: (index: number) => void,
) {
  if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key))
    return;
  event.preventDefault();
  const direction =
    event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = (currentIndex + direction + ids.length) % ids.length;
  select(nextIndex);
  document.getElementById(ids[nextIndex] ?? "")?.focus();
}
void moveRadioFocus;

function getStoredGuestName() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(GUEST_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function isValidTimeZone(value: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

function parseNearbySpot(value: unknown): Spot {
  const parsed = SpotSchema.parse(value);
  return {
    ...parsed,
    instagram: parsed.instagram ?? null,
  };
}

export function GameCreateForm({
  signedIn,
  initialPrefill,
}: {
  signedIn: boolean;
  initialPrefill?: GamePrefill | null;
}) {
  const router = useRouter();
  const [prefillSpot, setPrefillSpot] = useState<Spot | null>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillError, setPrefillError] = useState<string | null>(null);
  const preferredSport = usePreferencesStore((state) => state.preferredSport);
  const defaultDiscipline = resolveGameDiscipline(preferredSport);
  const [selectedDiscipline, setSelectedDiscipline] =
    useState<DisciplineSlug | null>(defaultDiscipline);

  useEffect(() => {
    if (defaultDiscipline) {
      setSelectedDiscipline(defaultDiscipline);
    }
  }, [defaultDiscipline]);

  const discipline = selectedDiscipline ?? defaultDiscipline;
  const [mode, setMode] = useState<GameMode>("training");
  const [ruleMode, setRuleMode] = useState<RuleMode>("flexible");
  const [level, setLevel] = useState<TrickLevel>(1);
  const [spotType, setSpotType] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [guestNickname, setGuestNickname] = useState(getStoredGuestName);
  const [timezone, setTimezone] = useState("");
  const prefillSpotAppliedRef = useRef<string | null>(null);
  const [startDelayMinutes, setStartDelayMinutes] =
    useState<ChallengeStartDelay>(3);
  const [options, setOptions] = useState<GameCreationOptions | null>(null);
  const [optionsDiscipline, setOptionsDiscipline] = useState<string | null>(
    null,
  );
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [nearbySpot, setNearbySpot] = useState<Spot | null>(null);
  const [spotAccepted, setSpotAccepted] = useState<boolean | null>(null);
  const [trainingSpotEnabled, setTrainingSpotEnabled] = useState(false);
  const [weatherConfirmed, setWeatherConfirmed] = useState<boolean | null>(
    null,
  );
  const [weatherObservedIcon, setWeatherObservedIcon] =
    useState<WeatherIconName | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<GameSetupStep>("settings");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const setupStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const setupContentRef = useRef<HTMLDivElement>(null);
  const setupTriggerRef = useRef<HTMLButtonElement>(null);
  const {
    status: locationStatus,
    location,
    request: requestLocation,
  } = useUserLocation();
  const distanceUnit = useDistanceUnit();
  const temperatureUnit = useTemperatureUnit();
  useEffect(() => {
    if (!discipline) {
      return;
    }

    const controller = new AbortController();
    void fetchWithTimeout(
      `/api/games/options?disciplineSlug=${encodeURIComponent(discipline)}`,
      {
        signal: controller.signal,
        cache: "no-store",
        timeoutMs: DEFAULT_READ_TIMEOUT_MS,
      },
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Game settings could not be loaded.");
        }
        const parsed = gameCreationOptionsSchema.safeParse(data);
        if (!parsed.success) throw new Error("Game settings are invalid.");
        setOptions(parsed.data);
        setOptionsDiscipline(discipline);
        setOptionsError(null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setOptionsDiscipline(discipline);
          setOptionsError(
            reason instanceof Error
              ? reason.message
              : "Game settings could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, [discipline]);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimezone(getBrowserTimeZone()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Prefill: apply mode from ?spotId&spotType&mode (Phase 1 contract)
  useEffect(() => {
    const nextMode = initialPrefill?.mode;
    if (nextMode && (nextMode === "training" || nextMode === "challenge")) {
      if (nextMode === "challenge" && (!signedIn || !discipline)) {
        return;
      }
      setMode(nextMode);
      setSetupStep("settings");
    }
  }, [initialPrefill?.mode, signedIn, discipline]);

  // Prefill: hydrate spot from ?spotId via GET /api/spots/[id] (list fallback)
  useEffect(() => {
    const spotId = initialPrefill?.spotId ?? null;
    if (!spotId) {
      setPrefillSpot(null);
      setPrefillError(null);
      setPrefillLoading(false);
      return;
    }
    const controller = new AbortController();
    setPrefillLoading(true);
    setPrefillError(null);
    void (async () => {
      try {
        let response = await fetchWithTimeout(`/api/spots/${encodeURIComponent(spotId)}`, {
          signal: controller.signal,
          cache: "no-store",
          timeoutMs: DEFAULT_READ_TIMEOUT_MS,
        });
        let data: unknown = await response.json().catch(() => null);
        let rawSpot: unknown = null;
        if (response.ok && data && typeof data === "object") {
          const candidate = data as Record<string, unknown>;
          if (typeof candidate.id === "string") {
            rawSpot = candidate;
          } else if (candidate.spot) {
            rawSpot = candidate.spot;
          }
        }
        if (!rawSpot) {
          response = await fetchWithTimeout(
            `/api/spots?ids=${encodeURIComponent(spotId)}`,
            {
              signal: controller.signal,
              cache: "no-store",
              timeoutMs: DEFAULT_READ_TIMEOUT_MS,
            },
          );
          data = await response.json().catch(() => null);
          const candidate =
            (data as {
              spot?: unknown;
              spots?: unknown[];
              items?: unknown[];
            } | null) ?? null;
          rawSpot =
            candidate?.spot ??
            candidate?.spots?.[0] ??
            (Array.isArray(candidate?.items) ? candidate?.items[0] : null) ??
            null;
          if (!response.ok || !rawSpot) {
            throw new Error(
              (candidate as { error?: string } | null)?.error ??
                "Spot not found.",
            );
          }
        }
        if (controller.signal.aborted) return;
        setPrefillSpot(parseNearbySpot(rawSpot));
        setPrefillError(null);
      } catch (e) {
        if (!controller.signal.aborted) {
          setPrefillError(
            e instanceof Error ? e.message : "Spot could not be loaded.",
          );
          setPrefillSpot(null);
        }
      } finally {
        if (!controller.signal.aborted) setPrefillLoading(false);
      }
    })();
    return () => controller.abort();
  }, [initialPrefill?.spotId]);

  // Keep nearbySpot in sync with hydrated prefill; auto-enable training spot when prefilled (both signed-in and guest)
  // Fixed: allow user to uncheck "Record at registered spot" even with prefill — only auto-enable once per prefill id
  useEffect(() => {
    if (!prefillSpot) {
      prefillSpotAppliedRef.current = null;
      return;
    }
    if (prefillSpotAppliedRef.current === prefillSpot.id) return;
    prefillSpotAppliedRef.current = prefillSpot.id;
    setNearbySpot(prefillSpot);
    if (mode === "training" && !trainingSpotEnabled) {
      setTrainingSpotEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally not depending on trainingSpotEnabled to allow user to uncheck
  }, [prefillSpot, mode]);

  // Training can optionally attach a registered spot (same 250m flow as challenge) — scalable for signed-in and guest
  const needsSpot =
    mode === "challenge" || (mode === "training" && trainingSpotEnabled);

  useEffect(() => {
    if (prefillSpot) return;
    if (
      !needsSpot ||
      locationStatus !== "granted" ||
      !location ||
      !discipline
    ) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setLocationLoading(true);
      setNearbySpot(null);
      setSpotAccepted(null);
      try {
        const spotsResponse = await fetchWithTimeout(
          `/api/games/nearby-spot?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}&disciplineSlug=${encodeURIComponent(discipline)}`,
          {
            signal: controller.signal,
            cache: "no-store",
            timeoutMs: DEFAULT_READ_TIMEOUT_MS,
          },
        );
        const spotsData = (await spotsResponse.json().catch(() => null)) as {
          spot?: unknown | null;
          error?: string;
        } | null;
        if (!spotsResponse.ok) {
          throw new Error(
            spotsData?.error ?? "A nearby spot could not be found.",
          );
        }
        if (controller.signal.aborted) return;
        setNearbySpot(spotsData?.spot ? parseNearbySpot(spotsData.spot) : null);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Spots could not be loaded.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLocationLoading(false);
      }
    })();

    return () => controller.abort();
  }, [
    discipline,
    location,
    locationStatus,
    mode,
    needsSpot,
    trainingSpotEnabled,
    signedIn,
    prefillSpot,
  ]);

  const selectedSpot = nearbySpot;
  const { weather: forecastWeather } = useSpotWeather(
    needsSpot && selectedSpot && spotAccepted === true ? selectedSpot.id : null,
  );

  // Reset weather confirmation when spot changes or is un-accepted
  useEffect(() => {
    if (!selectedSpot || spotAccepted !== true) {
      setWeatherConfirmed(null);
      setWeatherObservedIcon(null);
      setFieldErrors((current) => ({
        ...current,
        weather: undefined,
        weatherObserved: undefined,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedSpot.id is the stable identity
  }, [selectedSpot?.id, spotAccepted]);

  // Reset training spot state when switching modes (keep for guest → signed-in transition)
  useEffect(() => {
    if (mode !== "training") {
      setTrainingSpotEnabled(false);
    }
  }, [mode]);

  const activeOptions = optionsDiscipline === discipline ? options : null;
  const activeOptionsError =
    optionsDiscipline === discipline ? optionsError : null;
  const availableSpotTypes = useMemo(() => {
    if (!activeOptions) return [];
    if (!selectedSpot) return activeOptions.spotTypes;
    const spotTypeSlugs = new Set(selectedSpot.types.map((type) => type.slug));
    return activeOptions.spotTypes.filter((option) =>
      spotTypeSlugs.has(option.slug),
    );
  }, [activeOptions, selectedSpot]);
  // Catalog tricks carry full triple: level ∧ spotType ∧ categories
  const catalogTricks = useMemo(
    () => activeOptions?.tricks ?? [],
    [activeOptions],
  );
  const globalCategories = useMemo(() => {
    if (!activeOptions?.categories) return [];
    return [...activeOptions.categories].sort();
  }, [activeOptions]);

  const effectiveSpotType =
    availableSpotTypes.find((option) => option.slug === spotType)?.slug ??
    availableSpotTypes[0]?.slug ??
    "";
  // Prefill: seed spotType from ?spotType ∩ spot when hydrated and no user choice yet
  useEffect(() => {
    if (spotType !== "" || !prefillSpot || !activeOptions) return;
    const requested = initialPrefill?.spotType?.trim().toLowerCase() ?? null;
    const spotSlugs = new Set(prefillSpot.types.map((t) => t.slug));
    const allowed = availableSpotTypes.map((o) => o.slug);
    if (requested && spotSlugs.has(requested) && allowed.includes(requested)) {
      setSpotType(requested);
    } else {
      const firstSpotType = prefillSpot.types[0]?.slug ?? null;
      if (firstSpotType && allowed.includes(firstSpotType))
        setSpotType(firstSpotType);
    }
  }, [
    spotType,
    prefillSpot,
    activeOptions,
    initialPrefill,
    availableSpotTypes,
  ]);
  // Keep selected categories only in sync with GLOBAL options (never block), not scoped view
  useEffect(() => {
    if (globalCategories.length === 0) {
      if (selectedCategories.length > 0) setSelectedCategories([]);
      return;
    }
    const allowed = new Set(globalCategories.map((c) => c.toLowerCase()));
    const filtered = selectedCategories.filter((c) =>
      allowed.has(c.toLowerCase()),
    );
    if (filtered.length !== selectedCategories.length)
      setSelectedCategories(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalCategories]);

  const selectedSpotType = availableSpotTypes.find(
    (option) => option.slug === effectiveSpotType,
  );
  // AND-aware level: level must exist for current spotType ∧ selectedCategories
  const spotLevels = useMemo(
    () => selectedSpotType?.levels ?? ([1, 2, 3, 4, 5] as const),
    [selectedSpotType],
  );
  const levelsForSpotAndCategories = useMemo(
    () =>
      computeLevelsForSpotAndCategories(
        catalogTricks,
        effectiveSpotType,
        selectedCategories,
        spotLevels,
      ),
    [catalogTricks, effectiveSpotType, selectedCategories, spotLevels],
  );
  const effectiveLevel: TrickLevel = levelsForSpotAndCategories.includes(level)
    ? level
    : selectedSpotType?.levels.includes(level)
      ? level
      : (levelsForSpotAndCategories[0] ?? spotLevels[0] ?? 1);
  const availableLevels = levelsForSpotAndCategories;
  // Honest pools — show all global categories but disable zero-count (B)
  const availableCategories = useMemo(() => {
    if (!activeOptions) return [];
    return globalCategories;
  }, [activeOptions, globalCategories]);
  const categoryCounts = useMemo(
    () =>
      countTricksPerCategory(
        catalogTricks,
        effectiveSpotType,
        effectiveLevel,
        globalCategories,
      ),
    [catalogTricks, effectiveLevel, effectiveSpotType, globalCategories],
  );
  const levelCounts = useMemo(
    () =>
      countTricksPerLevel(catalogTricks, effectiveSpotType, selectedCategories),
    [catalogTricks, effectiveSpotType, selectedCategories],
  );
  // Eligible count for current AND triple (level ∧ spotType ∧ categories)
  const eligibleTrickCount = useMemo(
    () =>
      countEligibleTricks(
        catalogTricks,
        effectiveLevel,
        effectiveSpotType,
        selectedCategories,
      ),
    [catalogTricks, effectiveLevel, effectiveSpotType, selectedCategories],
  );
  const selectedDistanceMeters = selectedSpot
    ? location
      ? haversineMeters(
          location.lat,
          location.lon,
          selectedSpot.location.lat,
          selectedSpot.location.lon,
        )
      : null
    : null;
  const optionsLoading = Boolean(
    discipline && optionsDiscipline !== discipline,
  );
  const hasMissingOptions =
    optionsLoading ||
    !activeOptions ||
    availableSpotTypes.length === 0 ||
    !selectedSpotType;
  const prefillPending = Boolean(initialPrefill?.spotId && prefillLoading);
  const requiresWeather =
    needsSpot && Boolean(selectedSpot) && spotAccepted === true;
  const weatherPending =
    requiresWeather &&
    (weatherConfirmed === null ||
      (weatherConfirmed === false && !weatherObservedIcon) ||
      !forecastWeather);
  const createDisabled =
    busy ||
    prefillPending ||
    !discipline ||
    Boolean(activeOptionsError) ||
    hasMissingOptions ||
    (mode === "challenge" &&
      (locationLoading ||
        locationStatus !== "granted" ||
        !location ||
        !selectedSpot ||
        spotAccepted !== true)) ||
    (mode === "training" &&
      trainingSpotEnabled &&
      (locationLoading ||
        locationStatus !== "granted" ||
        !location ||
        !selectedSpot ||
        spotAccepted !== true)) ||
    weatherPending;
  const trainingStepIndex = Math.max(
    0,
    TRAINING_SETUP_STEPS.findIndex((step) => step.id === setupStep),
  );
  const challengeStepIndex = Math.max(
    0,
    CHALLENGE_SETUP_STEPS.findIndex((step) => step.id === setupStep),
  );
  const setupStepIndex =
    mode === "training" ? trainingStepIndex : challengeStepIndex;
  const setupStepCount =
    mode === "training"
      ? TRAINING_SETUP_STEPS.length
      : CHALLENGE_SETUP_STEPS.length;
  const setupStepDetails =
    mode === "training"
      ? (TRAINING_SETUP_STEPS[trainingStepIndex] ?? TRAINING_SETUP_STEPS[0])
      : (CHALLENGE_SETUP_STEPS[challengeStepIndex] ?? CHALLENGE_SETUP_STEPS[0]);

  useEffect(() => {
    if (!setupOpen) return;
    const frame = window.requestAnimationFrame(() => {
      const firstControl = setupContentRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
      );
      (firstControl ?? setupStepHeadingRef.current)?.focus({
        preventScroll: true,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [setupOpen, setupStep]);

  function clearFieldError(field: FieldName) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  }

  function handleModeChange(nextMode: GameMode) {
    setMode(nextMode);
    setSetupStep("settings");
    // if (nextMode === "challenge") setChallengeDetailsOpen(true);
    if (nextMode === "training") {
      // keep spot state but do not auto-enable; user opts in
    } else {
      setTrainingSpotEnabled(false);
    }
    setWeatherConfirmed(null);
    setWeatherObservedIcon(null);
    setFieldErrors({});
    setError(null);
  }

  function handleTrainingSpotToggle(enabled: boolean) {
    setTrainingSpotEnabled(enabled);
    setSpotAccepted(null);
    setWeatherConfirmed(null);
    setWeatherObservedIcon(null);
    setFieldErrors((current) => ({
      ...current,
      spot: undefined,
      weather: undefined,
      weatherObserved: undefined,
    }));
    setError(null);
    if (!enabled) {
      setNearbySpot(null);
      setLocationLoading(false);
    } else if (prefillSpot && !nearbySpot) {
      // Re-enable after user previously disabled: restore prefill spot instead of refetching
      setNearbySpot(prefillSpot);
    } else if (
      locationStatus !== "granted" &&
      locationStatus !== "requesting"
    ) {
      void retryLocation();
    }
  }

  function handleSpotTypeChange(nextSpotType: string) {
    setSpotType(nextSpotType);
    clearFieldError("spotType");
    // AND logic: next level must be compatible with spotType ∧ current categories
    const nextOption = availableSpotTypes.find((c) => c.slug === nextSpotType);
    const targetLevels = computeLevelsForSpotAndCategories(
      catalogTricks,
      nextSpotType,
      selectedCategories,
      nextOption?.levels ?? availableLevels,
    );
    if (!targetLevels.includes(level)) {
      setLevel(targetLevels[0] ?? 1);
      clearFieldError("level");
    }
  }

  function handleCategoryToggle(category: string) {
    const normalized = category.trim().toLowerCase();
    setSelectedCategories((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === normalized);
      const next = exists
        ? prev.filter((c) => c.toLowerCase() !== normalized)
        : prev.length >= 12
          ? prev
          : [...prev, normalized].sort();
      // Game strategy: selecting basics/warmup etc auto-selects involved levels for current spot (∧)
      if (!exists && catalogTricks.length > 0 && effectiveSpotType) {
        const involved = computeLevelsForSpotAndCategories(
          catalogTricks,
          effectiveSpotType,
          next,
          [],
        );
        if (involved.length > 0 && !involved.includes(level)) {
          // defer level change outside setSelectedCategories to avoid stale closure
          queueMicrotask(() => {
            setLevel(involved[0] ?? 1);
            clearFieldError("level");
          });
        }
      }
      return next;
    });
    clearFieldError("categories");
  }

  function handleSpotAcceptance(accepted: boolean) {
    setSpotAccepted(accepted);
    setWeatherConfirmed(null);
    setWeatherObservedIcon(null);
    setFieldErrors((current) => ({
      ...current,
      spot: undefined,
      weather: undefined,
      weatherObserved: undefined,
    }));
    setError(null);
  }

  function handleWeatherConfirm(confirmed: boolean) {
    setWeatherConfirmed(confirmed);
    if (confirmed) setWeatherObservedIcon(null);
    setFieldErrors((current) => ({
      ...current,
      weather: undefined,
      weatherObserved: undefined,
    }));
    setError(null);
  }

  function handleWeatherObservedChange(icon: WeatherIconName) {
    setWeatherObservedIcon(icon);
    setFieldErrors((current) => ({ ...current, weatherObserved: undefined }));
    setError(null);
  }

  function handleGuestNicknameChange(value: string) {
    setGuestNickname(value);
    clearFieldError("guestNickname");
  }

  async function retryLocation() {
    setError(null);
    setNearbySpot(null);
    setSpotAccepted(null);
    setLocationLoading(true);
    const nextStatus = await requestLocation();
    if (nextStatus !== "granted") setLocationLoading(false);
  }

  function getSettingsErrors(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (
      mode === "training" &&
      !signedIn &&
      !normalizeGuestName(guestNickname)
    ) {
      nextErrors.guestNickname =
        "Enter a rider name between 1 and 30 characters.";
    }

    // ruleMode always has a valid default (flexible/strict), no error needed
    return nextErrors;
  }

  function getTrickErrors(): FieldErrors {
    const nextErrors: FieldErrors = {};

    if (!effectiveSpotType || !selectedSpotType) {
      nextErrors.spotType = "Choose a compatible spot type.";
    }
    if (!selectedSpotType?.levels.includes(effectiveLevel)) {
      nextErrors.level = "Choose a level available for this spot type.";
    }
    // Game AND logic: level ∧ spotType ∧ categories must have at least one trick
    if (eligibleTrickCount !== null && eligibleTrickCount === 0) {
      nextErrors.categories = `No tricks for Level ${effectiveLevel} at ${effectiveSpotType} with ${selectedCategories.join(", ")} — switch to All, change level/spot, or pick another category.`;
    }

    return nextErrors;
  }

  function getSpotErrors(): FieldErrors {
    if (needsSpot) {
      if (selectedSpot && spotAccepted === true) return {};
      return {
        spot:
          mode === "challenge"
            ? "Accept the nearby spot to create the challenge."
            : "Accept the nearby spot to record this training.",
      };
    }
    return {};
  }

  function getWeatherErrors(): FieldErrors {
    if (!needsSpot || !selectedSpot || spotAccepted !== true) return {};
    if (weatherConfirmed === null) {
      return {
        weather: "Confirm whether the forecast matches the live weather.",
      };
    }
    if (weatherConfirmed === false && !weatherObservedIcon) {
      return { weatherObserved: "Select the correct live weather." };
    }
    if (!forecastWeather) {
      return {
        weather:
          "Weather for this spot is still loading. Try again in a moment.",
      };
    }
    return {};
  }

  function applyValidationErrors(nextErrors: FieldErrors) {
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Review the highlighted fields before creating the game.");
    }
  }

  function validateForm(): FieldErrors {
    const nextErrors: FieldErrors = getSettingsErrors();

    Object.assign(nextErrors, getTrickErrors());
    Object.assign(nextErrors, getSpotErrors());
    Object.assign(nextErrors, getWeatherErrors());

    applyValidationErrors(nextErrors);
    return nextErrors;
  }

  function validateSetupStep(step: GameSetupStep) {
    const nextErrors =
      step === "settings"
        ? getSettingsErrors()
        : step === "trick"
          ? getTrickErrors()
          : step === "time"
            ? {}
            : step === "spot"
              ? getSpotErrors()
              : step === "confirm"
                ? getWeatherErrors()
                : {};
    applyValidationErrors(nextErrors);
    return nextErrors;
  }

  function focusFirstInvalidField(scope: ParentNode = document) {
    requestAnimationFrame(() => {
      scope
        .querySelector<HTMLElement>(
          "[data-invalid='true'], input[aria-invalid='true']",
        )
        ?.focus();
    });
  }

  function focusSettingsAnchor() {
    const anchor = document.querySelector<HTMLElement>(
      `form#${GAME_CREATE_FORM_ID} #${GAME_SETTINGS_ANCHOR_ID}`,
    );
    if (!anchor) return false;

    anchor.focus({ preventScroll: true });
    anchor.scrollIntoView({ block: "start" });
    return true;
  }

  function handleSetupEdit() {
    setSetupOpen(false);
    window.setTimeout(() => {
      requestAnimationFrame(() => {
        if (!focusSettingsAnchor()) setupTriggerRef.current?.focus();
      });
    }, 0);
  }

  function openSetup() {
    setSetupStep("settings");
    setSetupOpen(true);
  }

  function advanceSetup() {
    const nextErrors = validateSetupStep(setupStep);
    if (Object.keys(nextErrors).length > 0) {
      window.setTimeout(() => {
        const dialog = document.getElementById(GAME_SETUP_DIALOG_ID);
        focusFirstInvalidField(dialog ?? document);
      }, 0);
      return;
    }

    let nextStep: GameSetupStep;
    if (mode === "training") {
      if (setupStep === "settings") nextStep = "trick";
      else if (setupStep === "trick") nextStep = "spot";
      else if (setupStep === "spot") nextStep = "confirm";
      else nextStep = "confirm";
    } else {
      if (setupStep === "settings") nextStep = "trick";
      else if (setupStep === "trick") nextStep = "time";
      else if (setupStep === "time") nextStep = "spot";
      else if (setupStep === "spot") nextStep = "confirm";
      else nextStep = "confirm";
    }
    setError(null);
    setSetupStep(nextStep);
  }

  function retreatSetup() {
    if (mode === "training") {
      if (setupStep === "confirm") setSetupStep("spot");
      else if (setupStep === "spot") setSetupStep("trick");
      else if (setupStep === "trick") setSetupStep("settings");
    } else {
      if (setupStep === "confirm") setSetupStep("spot");
      else if (setupStep === "spot") setSetupStep("time");
      else if (setupStep === "time") setSetupStep("trick");
      else if (setupStep === "trick") setSetupStep("settings");
    }
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const finalStep: GameSetupStep =
      mode === "training" ? "confirm" : "confirm";
    if (setupOpen && setupStep !== finalStep) {
      advanceSetup();
      return;
    }
    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      if (setupOpen) {
        if (nextErrors.guestNickname) {
          setSetupStep("settings");
          window.setTimeout(
            () => document.getElementById(GUEST_NICKNAME_SETUP_ID)?.focus(),
            0,
          );
        } else if (
          nextErrors.spot ||
          nextErrors.weather ||
          nextErrors.weatherObserved
        ) {
          // spot/weather errors map to spot weather step; for training spot before weather, show appropriate
          if (nextErrors.spot) setSetupStep("spot");
          else setSetupStep("confirm");
          window.setTimeout(() => {
            const dialog = document.getElementById(GAME_SETUP_DIALOG_ID);
            focusFirstInvalidField(dialog ?? document);
          }, 0);
        } else if (
          nextErrors.level ||
          nextErrors.spotType ||
          nextErrors.categories
        ) {
          setSetupStep("trick");
          window.setTimeout(() => {
            const dialog = document.getElementById(GAME_SETUP_DIALOG_ID);
            focusFirstInvalidField(dialog ?? document);
          }, 0);
        } else {
          setSetupStep("settings");
          window.setTimeout(() => {
            const dialog = document.getElementById(GAME_SETUP_DIALOG_ID);
            focusFirstInvalidField(dialog ?? document);
          }, 0);
        }
      } else {
        focusFirstInvalidField();
      }
      return;
    }
    if (!discipline || busy || submittingRef.current) return;

    submittingRef.current = true;
    if (mode === "training" && !signedIn) {
      const name = normalizeGuestName(guestNickname);
      if (!name) {
        submittingRef.current = false;
        return;
      }
      try {
        sessionStorage.setItem(GUEST_NAME_STORAGE_KEY, name);
      } catch {
        setError("Your rider name could not be stored in this browser.");
        submittingRef.current = false;
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetchWithTimeout("/api/games", {
        method: "POST",
        timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
        headers: {
          "content-type": "application/json",
          ...(mode === "training" && !signedIn
            ? {
                "x-guest-token": loadOrCreateGuestToken() ?? "",
                "x-guest-name": normalizeGuestName(guestNickname) ?? "",
              }
            : {}),
        },
        body: JSON.stringify({
          mode,
          ruleMode,
          gameFormat: "tricks",
          spotType: effectiveSpotType,
          level: effectiveLevel,
          categories: selectedCategories,
          disciplineSlug: discipline,
          ...(mode === "challenge" &&
          selectedSpot &&
          spotAccepted === true &&
          forecastWeather
            ? {
                spotId: selectedSpot.id,
                startDelayMinutes,
                timezone: isValidTimeZone(timezone)
                  ? timezone
                  : getBrowserTimeZone(),
                latitude: location?.lat,
                longitude: location?.lon,
                accuracyMeters: location?.accuracy,
                weatherForecastIcon: forecastWeather.icon,
                weatherForecastDescription:
                  forecastWeather.description ?? forecastWeather.icon,
                weatherForecastTemp:
                  typeof forecastWeather.current === "number"
                    ? Math.round(forecastWeather.current)
                    : null,
                weatherConfirmed: weatherConfirmed === true,
                weatherObservedIcon:
                  weatherConfirmed === false && weatherObservedIcon
                    ? weatherObservedIcon
                    : forecastWeather.icon,
              }
            : mode === "challenge"
              ? {
                  spotId: selectedSpot?.id,
                  startDelayMinutes,
                  timezone: isValidTimeZone(timezone)
                    ? timezone
                    : getBrowserTimeZone(),
                  latitude: location?.lat,
                  longitude: location?.lon,
                  accuracyMeters: location?.accuracy,
                }
              : {}),
          ...(mode === "training" &&
          trainingSpotEnabled &&
          selectedSpot &&
          spotAccepted === true &&
          forecastWeather
            ? {
                spotId: selectedSpot.id,
                latitude: location?.lat,
                longitude: location?.lon,
                accuracyMeters: location?.accuracy,
                weatherForecastIcon: forecastWeather.icon,
                weatherForecastDescription:
                  forecastWeather.description ?? forecastWeather.icon,
                weatherForecastTemp:
                  typeof forecastWeather.current === "number"
                    ? Math.round(forecastWeather.current)
                    : null,
                weatherConfirmed: weatherConfirmed === true,
                weatherObservedIcon:
                  weatherConfirmed === false && weatherObservedIcon
                    ? weatherObservedIcon
                    : forecastWeather.icon,
              }
            : {}),
          expectedVersion: 0,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const rawData = await response.json().catch(() => null);
      if (!response.ok) {
        setError(rawData?.error ?? "Game could not be created.");
        return;
      }
      const data = gameMutationResponseSchema.parse(rawData);
      // Reset the mobile setup wizard before leaving: the /games client tree
      // is preserved in the router cache, so without this a return from the
      // board would re-activate the landing with the dialog still open.
      setSetupOpen(false);
      setSetupStep("settings");
      router.push(`/games/${data.id}`);
    } catch {
      setError(
        "Game could not be created. Check your connection and try again.",
      );
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const selectedSpotTypeLabel =
    selectedSpotType?.name ??
    (effectiveSpotType ? effectiveSpotType : "Choose a spot type");
  const summarySpot = selectedSpot?.name ?? "Not selected";
  const summaryStart =
    CHALLENGE_START_OPTIONS.find((option) => option.value === startDelayMinutes)
      ?.title ?? "Not selected";
  const summaryWeather =
    !needsSpot || !selectedSpot || spotAccepted !== true
      ? "Not recorded"
      : !forecastWeather
        ? "Loading..."
        : weatherConfirmed === true
          ? `Forecast ${forecastWeather.icon} confirmed`
          : weatherConfirmed === false && weatherObservedIcon
            ? `Observed ${weatherObservedIcon} (forecast ${forecastWeather.icon})`
            : "Awaiting confirmation";
  const summaryProps = {
    mode,
    ruleMode,
    spotType: selectedSpotTypeLabel,
    level: effectiveLevel,
    categories:
      selectedCategories.length > 0 ? selectedCategories.join(", ") : "All",
    physicalSpot: summarySpot,
    scheduledStart: summaryStart,
    timezone: timezone || "Not selected",
    weather: summaryWeather,
  };

  return (
    <section
      aria-labelledby="game-create-title"
      className="pb-28 pt-2 sm:pb-28 sm:pt-10 lg:py-12"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-10">
          <form
            id={GAME_CREATE_FORM_ID}
            onSubmit={submit}
            noValidate
            className="min-w-0 space-y-6"
          >
            {preferredSport === "all" ? (
              <div
                role="group"
                aria-labelledby="game-discipline-label"
                className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    id="game-discipline-label"
                    className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                  >
                    Sport
                  </p>
                  <span className="font-display text-[10px] uppercase tracking-wide text-secondary">
                    {discipline
                      ? DISCIPLINE_TO_SPORT[
                          discipline as keyof typeof DISCIPLINE_TO_SPORT
                        ]
                      : "Select for match"}
                  </span>
                </div>
                <div
                  className="mt-3 flex flex-nowrap gap-2"
                  role="radiogroup"
                  aria-labelledby="game-discipline-label"
                >
                  {(["skateboard", "bmx", "scooter", "roller"] as const).map(
                    (slug) => {
                      const sportName = DISCIPLINE_TO_SPORT[slug];
                      const active = discipline === slug;
                      return (
                        <OptionChip
                          key={slug}
                          id={`game-sport-${slug}`}
                          active={active}
                          label={sportName}
                          role="radio"
                          ariaChecked={active}
                          tabIndex={active ? 0 : -1}
                          onClick={() => setSelectedDiscipline(slug)}
                        />
                      );
                    },
                  )}
                </div>
              </div>
            ) : null}
            <div
              role="group"
              aria-labelledby="game-mode-label"
              className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
            >
              <p
                id="game-mode-label"
                className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
              >
                Game mode
              </p>
              <div
                className="mt-3 flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby="game-mode-label"
              >
                <OptionChip
                  id="game-mode-training"
                  active={mode === "training"}
                  label="Training"
                  role="radio"
                  ariaChecked={mode === "training"}
                  tabIndex={mode === "training" ? 0 : -1}
                  disabled={!discipline}
                  onClick={() => handleModeChange("training")}
                  onKeyDown={(event) =>
                    moveRadioFocus(
                      event,
                      ["game-mode-training", "game-mode-challenge"],
                      0,
                      (index) =>
                        handleModeChange(
                          index === 0 ? "training" : "challenge",
                        ),
                    )
                  }
                />
                <OptionChip
                  id="game-mode-challenge"
                  active={mode === "challenge"}
                  label="Challenge"
                  role="radio"
                  ariaChecked={mode === "challenge"}
                  tabIndex={mode === "challenge" ? 0 : -1}
                  disabled={!discipline || !signedIn}
                  onClick={() => handleModeChange("challenge")}
                  onKeyDown={(event) =>
                    moveRadioFocus(
                      event,
                      ["game-mode-training", "game-mode-challenge"],
                      1,
                      (index) =>
                        handleModeChange(
                          index === 0 ? "training" : "challenge",
                        ),
                    )
                  }
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-on-surface-variant">
                {mode === "training"
                  ? "Open play. No schedule or location check."
                  : "Scheduled play at a registered spot."}
              </p>
            </div>

            {!signedIn ? (
              <p className="-mt-3 text-sm leading-6 text-on-primary">
                <Link
                  href="/login"
                  className="font-display font-bold uppercase underline decoration-2 underline-offset-4"
                >
                  Sign in to unlock Challenge
                </Link>{" "}
                games. Training is available to guests with a rider name.
              </p>
            ) : null}
            {initialPrefill?.mode === "challenge" && !signedIn ? (
              <p
                role="note"
                className="rounded-[8px] border border-outline-variant bg-surface-container px-3 py-2 text-xs"
              >
                This spot was opened as a Challenge. Sign in to create a
                Challenge here — or start a Training now.
              </p>
            ) : null}

            {/* Mobile: Active configuration summary & customize trigger */}
            <div className="space-y-3 lg:hidden">
              <ConfigurationSummary {...summaryProps} />
              <button
                type="button"
                onClick={openSetup}
                disabled={busy}
                aria-expanded={setupOpen}
                aria-controls={GAME_SETUP_DIALOG_ID}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                Customize settings
              </button>
            </div>

            <div className="hidden space-y-6 lg:block">
              {!signedIn && mode === "training" ? (
                <GuestNicknameField
                  id="guest-nickname-desktop"
                  value={guestNickname}
                  error={fieldErrors.guestNickname}
                  onChange={handleGuestNicknameChange}
                />
              ) : null}
              {prefillLoading ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-[8px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
                >
                  Loading spot…
                </p>
              ) : null}
              {prefillError ? (
                <p
                  role="alert"
                  className="rounded-[8px] bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  {prefillError} You can still create a classic training without
                  a spot.
                </p>
              ) : null}
              {signedIn &&
              prefillSpot &&
              prefillSpot.sports.length > 0 &&
              discipline &&
              DISCIPLINE_TO_SPORT[
                discipline as keyof typeof DISCIPLINE_TO_SPORT
              ] &&
              !prefillSpot.sports.includes(
                DISCIPLINE_TO_SPORT[
                  discipline as keyof typeof DISCIPLINE_TO_SPORT
                ],
              ) ? (
                <p role="note" className="text-xs text-secondary">
                  This spot isn&apos;t tagged for{" "}
                  {
                    DISCIPLINE_TO_SPORT[
                      discipline as keyof typeof DISCIPLINE_TO_SPORT
                    ]
                  }{" "}
                  — you can still create the game; available spot types are
                  filtered to this spot.
                </p>
              ) : null}
              <GameFormatSettings
                idPrefix="desktop"
                optionsLoading={optionsLoading}
                activeOptionsError={activeOptionsError}
                availableSpotTypes={availableSpotTypes}
                effectiveSpotType={effectiveSpotType}
                selectedSpotType={selectedSpotType}
                effectiveLevel={effectiveLevel}
                availableLevels={availableLevels}
                levelCounts={levelCounts}
                ruleMode={ruleMode}
                fieldErrors={fieldErrors}
                onSpotTypeChange={handleSpotTypeChange}
                onLevelChange={(nextLevel) => {
                  setLevel(nextLevel);
                  clearFieldError("level");
                }}
                onRuleModeChange={setRuleMode}
                clearFieldError={clearFieldError}
              />
              <CategoriesField
                categories={availableCategories}
                selectedCategories={selectedCategories}
                error={fieldErrors.categories}
                onToggle={handleCategoryToggle}
                disabled={optionsLoading || !!activeOptionsError}
                eligibleCount={eligibleTrickCount}
                effectiveSpotType={effectiveSpotType}
                effectiveLevel={effectiveLevel}
                categoryCounts={categoryCounts}
              />

              {mode === "challenge" ? (
                <>
                  <ChallengeTimeStep
                    idPrefix="desktop"
                    startDelayMinutes={startDelayMinutes}
                    onStartDelayChange={setStartDelayMinutes}
                    timezone={timezone}
                  />
                  <ChallengeSpotStep
                    selectedSpot={selectedSpot}
                    selectedDistanceMeters={selectedDistanceMeters}
                    distanceUnit={distanceUnit}
                    locationStatus={locationStatus}
                    locationLoading={locationLoading || prefillLoading}
                    spotAccepted={spotAccepted}
                    fieldError={fieldErrors.spot}
                    onSpotAcceptance={handleSpotAcceptance}
                    onContinueTraining={() => handleModeChange("training")}
                    onRetryLocation={() => void retryLocation()}
                  />
                  {selectedSpot && spotAccepted === true ? (
                    <WeatherConfirmSection
                      idPrefix="desktop"
                      forecastWeather={forecastWeather}
                      weatherConfirmed={weatherConfirmed}
                      weatherObservedIcon={weatherObservedIcon}
                      fieldError={fieldErrors.weather}
                      observedFieldError={fieldErrors.weatherObserved}
                      onConfirm={handleWeatherConfirm}
                      onObservedChange={handleWeatherObservedChange}
                      temperatureUnit={temperatureUnit}
                    />
                  ) : null}
                </>
              ) : null}
              {mode === "training" ? (
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={trainingSpotEnabled}
                      onChange={(event) =>
                        handleTrainingSpotToggle(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-outline-variant accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-xs font-bold uppercase tracking-[0.05em]">
                        Record at registered spot
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-on-surface-variant">
                        Attach this training to the nearby spot and confirm live
                        weather. This powers the spot&apos;s current weather and
                        your session record.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}
              {mode === "training" && trainingSpotEnabled ? (
                <>
                  <ChallengeSpotStep
                    selectedSpot={selectedSpot}
                    selectedDistanceMeters={selectedDistanceMeters}
                    distanceUnit={distanceUnit}
                    locationStatus={locationStatus}
                    locationLoading={locationLoading || prefillLoading}
                    spotAccepted={spotAccepted}
                    fieldError={fieldErrors.spot}
                    onSpotAcceptance={handleSpotAcceptance}
                    onContinueTraining={() => handleTrainingSpotToggle(false)}
                    onRetryLocation={() => void retryLocation()}
                  />
                  {selectedSpot && spotAccepted === true ? (
                    <WeatherConfirmSection
                      idPrefix="desktop-training"
                      forecastWeather={forecastWeather}
                      weatherConfirmed={weatherConfirmed}
                      weatherObservedIcon={weatherObservedIcon}
                      fieldError={fieldErrors.weather}
                      observedFieldError={fieldErrors.weatherObserved}
                      onConfirm={handleWeatherConfirm}
                      onObservedChange={handleWeatherObservedChange}
                      temperatureUnit={temperatureUnit}
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            {!setupOpen ? (
              <>
                {error ? (
                  <p
                    role="alert"
                    className="rounded-[8px] bg-error-container px-4 py-3 text-sm text-on-error-container"
                  >
                    {error}
                  </p>
                ) : null}
              </>
            ) : null}
          </form>

          <div className="min-w-0">
            <div className="hidden lg:block">
              <ConfigurationSummary {...summaryProps} />
              <CreateSubmitButton
                formId={GAME_CREATE_FORM_ID}
                mode={mode}
                disabled={createDisabled}
                busy={busy}
                testId="desktop-create-game"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-18 z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
        <button
          ref={setupTriggerRef}
          type="button"
          onClick={openSetup}
          disabled={busy}
          aria-expanded={setupOpen}
          aria-controls={GAME_SETUP_DIALOG_ID}
          data-testid="mobile-review-trigger"
          className="pointer-events-auto min-h-12 w-full rounded-full border border-primary bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary shadow-[0_8px_24px_rgba(18,18,18,0.12)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
        >
          {busy
            ? "Creating game..."
            : mode === "training"
              ? "Start Training"
              : "Create Challenge"}
        </button>
      </div>

      <Overlay
        isOpen={setupOpen}
        onClose={() => setSetupOpen(false)}
        labelledBy={GAME_SETUP_TITLE_ID}
        describedBy={GAME_SETUP_DESCRIPTION_ID}
        contentId={GAME_SETUP_DIALOG_ID}
        containerClassName="lg:hidden"
        panelClassName="mx-4 my-4 flex max-h-[calc(100dvh-2rem)] w-[min(42rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface shadow-[0_16px_48px_rgba(18,18,18,0.16)] sm:mx-auto"
      >
        <div className="flex items-start justify-between gap-4 border-b border-outline-variant p-4 sm:p-6">
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              {setupStepDetails.label} · Step {setupStepIndex + 1} of{" "}
              {setupStepCount}
            </p>
            <h2
              ref={setupStepHeadingRef}
              id={GAME_SETUP_TITLE_ID}
              tabIndex={-1}
              className="mt-2 font-display text-3xl font-bold uppercase leading-none outline-none"
            >
              {mode === "training" ? "Start training" : "Create challenge"}
            </h2>
            <p
              id={GAME_SETUP_DESCRIPTION_ID}
              className="mt-2 text-sm leading-5 text-on-surface-variant"
            >
              {setupStepDetails.title}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSetupEdit}
            disabled={busy}
            aria-label="Back to game form"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <SetupProgress
          currentStep={setupStep}
          steps={
            mode === "training" ? TRAINING_SETUP_STEPS : CHALLENGE_SETUP_STEPS
          }
        />
        <div
          ref={setupContentRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
        >
          {mode === "training" ? (
            setupStep === "settings" ? (
              <div className="space-y-6">
                {!signedIn ? (
                  <GuestNicknameField
                    id={GUEST_NICKNAME_SETUP_ID}
                    value={guestNickname}
                    error={fieldErrors.guestNickname}
                    onChange={handleGuestNicknameChange}
                  />
                ) : null}
                <div
                  role="group"
                  aria-labelledby="mobile-challenge-rule-mode-label"
                  className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
                >
                  <p
                    id="mobile-challenge-rule-mode-label"
                    className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                  >
                    Rule mode
                  </p>
                  <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                    Flexible: leader can move on. Strict: challenge stays open.
                  </p>
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Rule mode"
                  >
                    <OptionChip
                      active={ruleMode === "flexible"}
                      label="Flexible"
                      role="radio"
                      ariaChecked={ruleMode === "flexible"}
                      onClick={() => setRuleMode("flexible")}
                    />
                    <OptionChip
                      active={ruleMode === "strict"}
                      label="Strict"
                      role="radio"
                      ariaChecked={ruleMode === "strict"}
                      onClick={() => setRuleMode("strict")}
                    />
                  </div>
                </div>
              </div>
            ) : setupStep === "trick" ? (
              <div className="space-y-6">
                {prefillLoading ? (
                  <p
                    role="status"
                    aria-live="polite"
                    className="rounded-[8px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
                  >
                    Loading spot…
                  </p>
                ) : null}
                {prefillError ? (
                  <p
                    role="alert"
                    className="rounded-[8px] bg-error-container px-4 py-3 text-sm text-on-error-container"
                  >
                    {prefillError} You can still create a classic training
                    without a spot.
                  </p>
                ) : null}
                {signedIn &&
                prefillSpot &&
                prefillSpot.sports.length > 0 &&
                discipline &&
                DISCIPLINE_TO_SPORT[
                  discipline as keyof typeof DISCIPLINE_TO_SPORT
                ] &&
                !prefillSpot.sports.includes(
                  DISCIPLINE_TO_SPORT[
                    discipline as keyof typeof DISCIPLINE_TO_SPORT
                  ],
                ) ? (
                  <p role="note" className="text-xs text-secondary">
                    This spot isn&apos;t tagged for{" "}
                    {
                      DISCIPLINE_TO_SPORT[
                        discipline as keyof typeof DISCIPLINE_TO_SPORT
                      ]
                    }{" "}
                    — you can still create the game; available spot types are
                    filtered to this spot.
                  </p>
                ) : null}
                <div
                  role="group"
                  aria-labelledby="mobile-challenge-spot-type-label"
                  className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
                >
                  <p
                    id="mobile-challenge-spot-type-label"
                    className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                  >
                    Spot type
                  </p>
                  {optionsLoading ? (
                    <div
                      className="mt-3 h-11  rounded-[16px] border border-outline-variant bg-surface-container"
                      aria-label="Loading spot types"
                    />
                  ) : activeOptionsError ? (
                    <p
                      className="mt-3 rounded-[8px] bg-error-container px-3 py-3 text-sm text-on-error-container"
                      role="alert"
                    >
                      {activeOptionsError}
                    </p>
                  ) : availableSpotTypes.length === 0 ? (
                    <p className="mt-3 rounded-[8px] bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                      No compatible spot types are available for this game.
                    </p>
                  ) : (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      role="radiogroup"
                      aria-label="Spot type"
                    >
                      {availableSpotTypes.map((option, index) => (
                        <OptionChip
                          key={option.slug}
                          active={effectiveSpotType === option.slug}
                          label={option.name}
                          role="radio"
                          ariaChecked={effectiveSpotType === option.slug}
                          invalid={Boolean(fieldErrors.spotType) && index === 0}
                          onClick={() => handleSpotTypeChange(option.slug)}
                        />
                      ))}
                    </div>
                  )}
                  {fieldErrors.spotType ? (
                    <FieldError>{fieldErrors.spotType}</FieldError>
                  ) : null}
                </div>
                <div
                  role="group"
                  aria-labelledby="mobile-challenge-level-label"
                  className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
                >
                  <p
                    id="mobile-challenge-level-label"
                    className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                  >
                    Level
                  </p>
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Trick level"
                  >
                    {([1, 2, 3, 4, 5] as const).map((option, index) => {
                      const hasData = levelCounts
                        ? Array.from(levelCounts.values()).some((v) => v > 0)
                        : false;
                      return (
                        <OptionChip
                          key={option}
                          active={effectiveLevel === option}
                          label={
                            hasData
                              ? `Level ${option} (${levelCounts?.get(option) ?? 0})`
                              : `Level ${option}`
                          }
                          role="radio"
                          ariaChecked={effectiveLevel === option}
                          disabled={
                            !selectedSpotType ||
                            !availableLevels.includes(option)
                          }
                          invalid={Boolean(fieldErrors.level) && index === 0}
                          onClick={() => {
                            setLevel(option);
                            clearFieldError("level");
                          }}
                        />
                      );
                    })}
                  </div>
                  {fieldErrors.level ? (
                    <FieldError>{fieldErrors.level}</FieldError>
                  ) : null}
                </div>
                <CategoriesField
                  categories={availableCategories}
                  selectedCategories={selectedCategories}
                  error={fieldErrors.categories}
                  onToggle={handleCategoryToggle}
                  disabled={optionsLoading || !!activeOptionsError}
                  eligibleCount={eligibleTrickCount}
                  effectiveSpotType={effectiveSpotType}
                  categoryCounts={categoryCounts}
                  effectiveLevel={effectiveLevel}
                />
              </div>
            ) : setupStep === "spot" ? (
              <div className="space-y-6">
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-low p-4">
                  <p className="font-display text-sm font-bold uppercase">
                    Where will you ride?
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    Training can be open play or anchored to a registered spot.
                    Anchoring records weather and powers the spot&apos;s live
                    status.
                  </p>
                </div>
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={trainingSpotEnabled}
                      onChange={(event) =>
                        handleTrainingSpotToggle(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 rounded border-outline-variant accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block font-display text-xs font-bold uppercase tracking-[0.05em]">
                        Record at registered spot
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-on-surface-variant">
                        Attach this training to the nearby spot and confirm live
                        weather. This powers the spot&apos;s current weather and
                        your session record.
                      </span>
                    </span>
                  </label>
                </div>
                {trainingSpotEnabled ? (
                  <ChallengeSpotStep
                    selectedSpot={selectedSpot}
                    selectedDistanceMeters={selectedDistanceMeters}
                    distanceUnit={distanceUnit}
                    locationStatus={locationStatus}
                    locationLoading={locationLoading || prefillLoading}
                    spotAccepted={spotAccepted}
                    fieldError={fieldErrors.spot}
                    onSpotAcceptance={handleSpotAcceptance}
                    onContinueTraining={() => handleTrainingSpotToggle(false)}
                    onRetryLocation={() => void retryLocation()}
                  />
                ) : (
                  <div className="rounded-[16px] border border-dashed border-outline-variant bg-surface-container-low px-4 py-4">
                    <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                      Open training
                    </p>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      No spot required. Continue to confirm and start the lobby.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {trainingSpotEnabled &&
                selectedSpot &&
                spotAccepted === true ? (
                  <>
                    <WeatherConfirmSection
                      forecastWeather={forecastWeather}
                      weatherConfirmed={weatherConfirmed}
                      weatherObservedIcon={weatherObservedIcon}
                      fieldError={fieldErrors.weather}
                      observedFieldError={fieldErrors.weatherObserved}
                      onConfirm={handleWeatherConfirm}
                      onObservedChange={handleWeatherObservedChange}
                      temperatureUnit={temperatureUnit}
                    />
                    <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                      <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                        Summary
                      </p>
                      <dl className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">Spot type</dt>
                          <dd className="font-display font-bold uppercase">
                            {selectedSpotType?.name ?? effectiveSpotType}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">Level</dt>
                          <dd className="font-display font-bold uppercase">
                            Level {effectiveLevel}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">
                            Categories
                          </dt>
                          <dd className="max-w-[10rem] truncate text-right font-display font-bold uppercase">
                            {selectedCategories.length > 0
                              ? selectedCategories.join(", ")
                              : "All"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-on-surface-variant">Spot</dt>
                          <dd className="max-w-[10rem] truncate text-right font-display font-bold uppercase">
                            {selectedSpot.name}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </>
                ) : trainingSpotEnabled ? (
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                    <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                      Spot required
                    </p>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      Go back and accept the nearby spot to record weather. Or
                      disable recording to start open training.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-low p-4">
                    <p className="font-display text-sm font-bold uppercase">
                      Ready to start
                    </p>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      Training will start as open play without a registered
                      spot.
                    </p>
                    <dl className="mt-4 space-y-2 rounded-[8px] border border-outline-variant bg-surface-container-lowest p-3 text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Spot type</dt>
                        <dd className="font-display font-bold uppercase">
                          {selectedSpotType?.name ?? effectiveSpotType}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Level</dt>
                        <dd className="font-display font-bold uppercase">
                          Level {effectiveLevel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Categories</dt>
                        <dd className="max-w-[10rem] truncate text-right font-display font-bold uppercase">
                          {selectedCategories.length > 0
                            ? selectedCategories.join(", ")
                            : "All"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            )
          ) : setupStep === "settings" ? (
            <div className="space-y-6">
              <div
                role="group"
                aria-labelledby="mobile-training-rule-mode-label"
                className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
              >
                <p
                  id="mobile-training-rule-mode-label"
                  className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                >
                  Rule mode
                </p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  Flexible: leader can move on. Strict: challenge stays open.
                </p>
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Rule mode"
                >
                  <OptionChip
                    active={ruleMode === "flexible"}
                    label="Flexible"
                    role="radio"
                    ariaChecked={ruleMode === "flexible"}
                    onClick={() => setRuleMode("flexible")}
                  />
                  <OptionChip
                    active={ruleMode === "strict"}
                    label="Strict"
                    role="radio"
                    ariaChecked={ruleMode === "strict"}
                    onClick={() => setRuleMode("strict")}
                  />
                </div>
              </div>
            </div>
          ) : setupStep === "trick" ? (
            <div className="space-y-6">
              {prefillLoading ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-[8px] border border-outline-variant bg-surface-container px-4 py-3 text-sm text-on-surface-variant"
                >
                  Loading spot…
                </p>
              ) : null}
              {prefillError ? (
                <p
                  role="alert"
                  className="rounded-[8px] bg-error-container px-4 py-3 text-sm text-on-error-container"
                >
                  {prefillError} You can still create a classic training without
                  a spot.
                </p>
              ) : null}
              {signedIn &&
              prefillSpot &&
              prefillSpot.sports.length > 0 &&
              discipline &&
              DISCIPLINE_TO_SPORT[
                discipline as keyof typeof DISCIPLINE_TO_SPORT
              ] &&
              !prefillSpot.sports.includes(
                DISCIPLINE_TO_SPORT[
                  discipline as keyof typeof DISCIPLINE_TO_SPORT
                ],
              ) ? (
                <p role="note" className="text-xs text-secondary">
                  This spot isn&apos;t tagged for{" "}
                  {
                    DISCIPLINE_TO_SPORT[
                      discipline as keyof typeof DISCIPLINE_TO_SPORT
                    ]
                  }{" "}
                  — you can still create the game; available spot types are
                  filtered to this spot.
                </p>
              ) : null}
              <div
                role="group"
                aria-labelledby="challenge-step-spot-type-label"
                className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
              >
                <p
                  id="challenge-step-spot-type-label"
                  className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                >
                  Spot type
                </p>
                {optionsLoading ? (
                  <div
                    className="mt-3 h-11  rounded-[16px] border border-outline-variant bg-surface-container"
                    aria-label="Loading spot types"
                  />
                ) : activeOptionsError ? (
                  <p
                    className="mt-3 rounded-[8px] bg-error-container px-3 py-3 text-sm text-on-error-container"
                    role="alert"
                  >
                    {activeOptionsError}
                  </p>
                ) : availableSpotTypes.length === 0 ? (
                  <p className="mt-3 rounded-[8px] bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
                    No compatible spot types are available for this game.
                  </p>
                ) : (
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Spot type"
                  >
                    {availableSpotTypes.map((option, index) => (
                      <OptionChip
                        key={option.slug}
                        active={effectiveSpotType === option.slug}
                        label={option.name}
                        role="radio"
                        ariaChecked={effectiveSpotType === option.slug}
                        invalid={Boolean(fieldErrors.spotType) && index === 0}
                        onClick={() => handleSpotTypeChange(option.slug)}
                      />
                    ))}
                  </div>
                )}
                {fieldErrors.spotType ? (
                  <FieldError>{fieldErrors.spotType}</FieldError>
                ) : null}
              </div>
              <div
                role="group"
                aria-labelledby="challenge-step-level-label"
                className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5"
              >
                <p
                  id="challenge-step-level-label"
                  className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary"
                >
                  Level
                </p>
                <div
                  className="mt-3 flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Trick level"
                >
                  {([1, 2, 3, 4, 5] as const).map((option, index) => {
                    const hasData = levelCounts
                      ? Array.from(levelCounts.values()).some((v) => v > 0)
                      : false;
                    return (
                      <OptionChip
                        key={option}
                        active={effectiveLevel === option}
                        label={
                          hasData
                            ? `Level ${option} (${levelCounts?.get(option) ?? 0})`
                            : `Level ${option}`
                        }
                        role="radio"
                        ariaChecked={effectiveLevel === option}
                        disabled={
                          !selectedSpotType || !availableLevels.includes(option)
                        }
                        invalid={Boolean(fieldErrors.level) && index === 0}
                        onClick={() => {
                          setLevel(option);
                          clearFieldError("level");
                        }}
                      />
                    );
                  })}
                </div>
                {fieldErrors.level ? (
                  <FieldError>{fieldErrors.level}</FieldError>
                ) : null}
              </div>
              <CategoriesField
                categories={availableCategories}
                selectedCategories={selectedCategories}
                error={fieldErrors.categories}
                onToggle={handleCategoryToggle}
                disabled={optionsLoading || !!activeOptionsError}
                eligibleCount={eligibleTrickCount}
                effectiveSpotType={effectiveSpotType}
                categoryCounts={categoryCounts}
                effectiveLevel={effectiveLevel}
              />
            </div>
          ) : setupStep === "time" ? (
            <ChallengeTimeStep
              startDelayMinutes={startDelayMinutes}
              onStartDelayChange={setStartDelayMinutes}
              timezone={timezone}
            />
          ) : setupStep === "spot" ? (
            <div className="space-y-6">
              <ChallengeSpotStep
                selectedSpot={selectedSpot}
                selectedDistanceMeters={selectedDistanceMeters}
                distanceUnit={distanceUnit}
                locationStatus={locationStatus}
                locationLoading={locationLoading || prefillLoading}
                spotAccepted={spotAccepted}
                fieldError={fieldErrors.spot}
                onSpotAcceptance={handleSpotAcceptance}
                onContinueTraining={() => handleModeChange("training")}
                onRetryLocation={() => void retryLocation()}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {selectedSpot && spotAccepted === true ? (
                <>
                  <WeatherConfirmSection
                    forecastWeather={forecastWeather}
                    weatherConfirmed={weatherConfirmed}
                    weatherObservedIcon={weatherObservedIcon}
                    fieldError={fieldErrors.weather}
                    observedFieldError={fieldErrors.weatherObserved}
                    onConfirm={handleWeatherConfirm}
                    onObservedChange={handleWeatherObservedChange}
                    temperatureUnit={temperatureUnit}
                  />
                  <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                    <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                      Summary
                    </p>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Spot type</dt>
                        <dd className="font-display font-bold uppercase">
                          {selectedSpotType?.name ?? effectiveSpotType}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Level</dt>
                        <dd className="font-display font-bold uppercase">
                          Level {effectiveLevel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Categories</dt>
                        <dd className="max-w-[10rem] truncate text-right font-display font-bold uppercase">
                          {selectedCategories.length > 0
                            ? selectedCategories.join(", ")
                            : "All"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Spot</dt>
                        <dd className="max-w-[10rem] truncate text-right font-display font-bold uppercase">
                          {selectedSpot.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-on-surface-variant">Start</dt>
                        <dd className="font-display font-bold uppercase">
                          {CHALLENGE_START_OPTIONS.find(
                            (o) => o.value === startDelayMinutes,
                          )?.title ?? ""}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </>
              ) : (
                <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
                  <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-secondary">
                    Spot required
                  </p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    Accept the nearby spot to confirm weather. Go back to the
                    Spot step.
                  </p>
                </div>
              )}
            </div>
          )}
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-[8px] bg-error-container px-4 py-3 text-sm text-on-error-container"
            >
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant p-4 sm:p-6">
          {(mode === "training" && setupStep !== "settings") ||
          (mode === "challenge" && setupStep !== "settings") ? (
            <button
              type="button"
              onClick={retreatSetup}
              disabled={busy}
              className="min-h-12 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          {(mode === "training" && setupStep !== "confirm") ||
          (mode === "challenge" && setupStep !== "confirm") ? (
            <button
              type="button"
              onClick={advanceSetup}
              disabled={busy}
              className="min-h-12 rounded-full border border-primary bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary shadow-[0_8px_24px_rgba(18,18,18,0.12)] transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none"
            >
              Continue
            </button>
          ) : (
            <CreateSubmitButton
              formId={GAME_CREATE_FORM_ID}
              mode={mode}
              disabled={createDisabled}
              busy={busy}
              testId="mobile-create-game"
            />
          )}
        </div>
      </Overlay>
      <GameTransitionLoader isOpen={busy} variant="creating" mode={mode} />
    </section>
  );
}
