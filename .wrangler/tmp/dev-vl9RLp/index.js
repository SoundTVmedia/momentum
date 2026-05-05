var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
var init_utils = __esm({
  "node_modules/unenv/dist/runtime/_internal/utils.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(createNotImplementedError, "createNotImplementedError");
    __name(notImplemented, "notImplemented");
    __name(notImplementedClass, "notImplementedClass");
  }
});

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin, _performanceNow, nodeTiming, PerformanceEntry, PerformanceMark, PerformanceMeasure, PerformanceResourceTiming, PerformanceObserverEntryList, Performance, PerformanceObserver, performance;
var init_performance = __esm({
  "node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_utils();
    _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
    _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
    nodeTiming = {
      name: "node",
      entryType: "node",
      startTime: 0,
      duration: 0,
      nodeStart: 0,
      v8Start: 0,
      bootstrapComplete: 0,
      environment: 0,
      loopStart: 0,
      loopExit: 0,
      idleTime: 0,
      uvMetricsInfo: {
        loopCount: 0,
        events: 0,
        eventsWaiting: 0
      },
      detail: void 0,
      toJSON() {
        return this;
      }
    };
    PerformanceEntry = class {
      static {
        __name(this, "PerformanceEntry");
      }
      __unenv__ = true;
      detail;
      entryType = "event";
      name;
      startTime;
      constructor(name, options) {
        this.name = name;
        this.startTime = options?.startTime || _performanceNow();
        this.detail = options?.detail;
      }
      get duration() {
        return _performanceNow() - this.startTime;
      }
      toJSON() {
        return {
          name: this.name,
          entryType: this.entryType,
          startTime: this.startTime,
          duration: this.duration,
          detail: this.detail
        };
      }
    };
    PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
      static {
        __name(this, "PerformanceMark");
      }
      entryType = "mark";
      constructor() {
        super(...arguments);
      }
      get duration() {
        return 0;
      }
    };
    PerformanceMeasure = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceMeasure");
      }
      entryType = "measure";
    };
    PerformanceResourceTiming = class extends PerformanceEntry {
      static {
        __name(this, "PerformanceResourceTiming");
      }
      entryType = "resource";
      serverTiming = [];
      connectEnd = 0;
      connectStart = 0;
      decodedBodySize = 0;
      domainLookupEnd = 0;
      domainLookupStart = 0;
      encodedBodySize = 0;
      fetchStart = 0;
      initiatorType = "";
      name = "";
      nextHopProtocol = "";
      redirectEnd = 0;
      redirectStart = 0;
      requestStart = 0;
      responseEnd = 0;
      responseStart = 0;
      secureConnectionStart = 0;
      startTime = 0;
      transferSize = 0;
      workerStart = 0;
      responseStatus = 0;
    };
    PerformanceObserverEntryList = class {
      static {
        __name(this, "PerformanceObserverEntryList");
      }
      __unenv__ = true;
      getEntries() {
        return [];
      }
      getEntriesByName(_name, _type) {
        return [];
      }
      getEntriesByType(type) {
        return [];
      }
    };
    Performance = class {
      static {
        __name(this, "Performance");
      }
      __unenv__ = true;
      timeOrigin = _timeOrigin;
      eventCounts = /* @__PURE__ */ new Map();
      _entries = [];
      _resourceTimingBufferSize = 0;
      navigation = void 0;
      timing = void 0;
      timerify(_fn, _options) {
        throw createNotImplementedError("Performance.timerify");
      }
      get nodeTiming() {
        return nodeTiming;
      }
      eventLoopUtilization() {
        return {};
      }
      markResourceTiming() {
        return new PerformanceResourceTiming("");
      }
      onresourcetimingbufferfull = null;
      now() {
        if (this.timeOrigin === _timeOrigin) {
          return _performanceNow();
        }
        return Date.now() - this.timeOrigin;
      }
      clearMarks(markName) {
        this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
      }
      clearMeasures(measureName) {
        this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
      }
      clearResourceTimings() {
        this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
      }
      getEntries() {
        return this._entries;
      }
      getEntriesByName(name, type) {
        return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
      }
      getEntriesByType(type) {
        return this._entries.filter((e) => e.entryType === type);
      }
      mark(name, options) {
        const entry = new PerformanceMark(name, options);
        this._entries.push(entry);
        return entry;
      }
      measure(measureName, startOrMeasureOptions, endMark) {
        let start;
        let end;
        if (typeof startOrMeasureOptions === "string") {
          start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
          end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
        } else {
          start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
          end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
        }
        const entry = new PerformanceMeasure(measureName, {
          startTime: start,
          detail: {
            start,
            end
          }
        });
        this._entries.push(entry);
        return entry;
      }
      setResourceTimingBufferSize(maxSize) {
        this._resourceTimingBufferSize = maxSize;
      }
      addEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.addEventListener");
      }
      removeEventListener(type, listener, options) {
        throw createNotImplementedError("Performance.removeEventListener");
      }
      dispatchEvent(event) {
        throw createNotImplementedError("Performance.dispatchEvent");
      }
      toJSON() {
        return this;
      }
    };
    PerformanceObserver = class {
      static {
        __name(this, "PerformanceObserver");
      }
      __unenv__ = true;
      static supportedEntryTypes = [];
      _callback = null;
      constructor(callback) {
        this._callback = callback;
      }
      takeRecords() {
        return [];
      }
      disconnect() {
        throw createNotImplementedError("PerformanceObserver.disconnect");
      }
      observe(options) {
        throw createNotImplementedError("PerformanceObserver.observe");
      }
      bind(fn) {
        return fn;
      }
      runInAsyncScope(fn, thisArg, ...args) {
        return fn.call(thisArg, ...args);
      }
      asyncId() {
        return 0;
      }
      triggerAsyncId() {
        return 0;
      }
      emitDestroy() {
        return this;
      }
    };
    performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();
  }
});

// node_modules/unenv/dist/runtime/node/perf_hooks.mjs
var init_perf_hooks = __esm({
  "node_modules/unenv/dist/runtime/node/perf_hooks.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_performance();
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
var init_performance2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs"() {
    init_perf_hooks();
    if (!("__unenv__" in performance)) {
      const proto = Performance.prototype;
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (key !== "constructor" && !(key in performance)) {
          const desc = Object.getOwnPropertyDescriptor(proto, key);
          if (desc) {
            Object.defineProperty(performance, key, desc);
          }
        }
      }
    }
    globalThis.performance = performance;
    globalThis.Performance = Performance;
    globalThis.PerformanceEntry = PerformanceEntry;
    globalThis.PerformanceMark = PerformanceMark;
    globalThis.PerformanceMeasure = PerformanceMeasure;
    globalThis.PerformanceObserver = PerformanceObserver;
    globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
    globalThis.PerformanceResourceTiming = PerformanceResourceTiming;
  }
});

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default;
var init_noop = __esm({
  "node_modules/unenv/dist/runtime/mock/noop.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    noop_default = Object.assign(() => {
    }, { __unenv__: true });
  }
});

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";
var _console, _ignoreErrors, _stderr, _stdout, log, info, trace, debug, table, error, warn, createTask, clear, count, countReset, dir, dirxml, group, groupEnd, groupCollapsed, profile, profileEnd, time, timeEnd, timeLog, timeStamp, Console, _times, _stdoutErrorHandler, _stderrErrorHandler;
var init_console = __esm({
  "node_modules/unenv/dist/runtime/node/console.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_noop();
    init_utils();
    _console = globalThis.console;
    _ignoreErrors = true;
    _stderr = new Writable();
    _stdout = new Writable();
    log = _console?.log ?? noop_default;
    info = _console?.info ?? log;
    trace = _console?.trace ?? info;
    debug = _console?.debug ?? log;
    table = _console?.table ?? log;
    error = _console?.error ?? log;
    warn = _console?.warn ?? error;
    createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
    clear = _console?.clear ?? noop_default;
    count = _console?.count ?? noop_default;
    countReset = _console?.countReset ?? noop_default;
    dir = _console?.dir ?? noop_default;
    dirxml = _console?.dirxml ?? noop_default;
    group = _console?.group ?? noop_default;
    groupEnd = _console?.groupEnd ?? noop_default;
    groupCollapsed = _console?.groupCollapsed ?? noop_default;
    profile = _console?.profile ?? noop_default;
    profileEnd = _console?.profileEnd ?? noop_default;
    time = _console?.time ?? noop_default;
    timeEnd = _console?.timeEnd ?? noop_default;
    timeLog = _console?.timeLog ?? noop_default;
    timeStamp = _console?.timeStamp ?? noop_default;
    Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
    _times = /* @__PURE__ */ new Map();
    _stdoutErrorHandler = noop_default;
    _stderrErrorHandler = noop_default;
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole, assert, clear2, context, count2, countReset2, createTask2, debug2, dir2, dirxml2, error2, group2, groupCollapsed2, groupEnd2, info2, log2, profile2, profileEnd2, table2, time2, timeEnd2, timeLog2, timeStamp2, trace2, warn2, console_default;
var init_console2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_console();
    workerdConsole = globalThis["console"];
    ({
      assert,
      clear: clear2,
      context: (
        // @ts-expect-error undocumented public API
        context
      ),
      count: count2,
      countReset: countReset2,
      createTask: (
        // @ts-expect-error undocumented public API
        createTask2
      ),
      debug: debug2,
      dir: dir2,
      dirxml: dirxml2,
      error: error2,
      group: group2,
      groupCollapsed: groupCollapsed2,
      groupEnd: groupEnd2,
      info: info2,
      log: log2,
      profile: profile2,
      profileEnd: profileEnd2,
      table: table2,
      time: time2,
      timeEnd: timeEnd2,
      timeLog: timeLog2,
      timeStamp: timeStamp2,
      trace: trace2,
      warn: warn2
    } = workerdConsole);
    Object.assign(workerdConsole, {
      Console,
      _ignoreErrors,
      _stderr,
      _stderrErrorHandler,
      _stdout,
      _stdoutErrorHandler,
      _times
    });
    console_default = workerdConsole;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console"() {
    init_console2();
    globalThis.console = console_default;
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime;
var init_hrtime = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
      const now = Date.now();
      const seconds = Math.trunc(now / 1e3);
      const nanos = now % 1e3 * 1e6;
      if (startTime) {
        let diffSeconds = seconds - startTime[0];
        let diffNanos = nanos - startTime[0];
        if (diffNanos < 0) {
          diffSeconds = diffSeconds - 1;
          diffNanos = 1e9 + diffNanos;
        }
        return [diffSeconds, diffNanos];
      }
      return [seconds, nanos];
    }, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
      return BigInt(Date.now() * 1e6);
    }, "bigint") });
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream;
var init_read_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    ReadStream = class {
      static {
        __name(this, "ReadStream");
      }
      fd;
      isRaw = false;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      setRawMode(mode) {
        this.isRaw = mode;
        return this;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream;
var init_write_stream = __esm({
  "node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    WriteStream = class {
      static {
        __name(this, "WriteStream");
      }
      fd;
      columns = 80;
      rows = 24;
      isTTY = false;
      constructor(fd) {
        this.fd = fd;
      }
      clearLine(dir3, callback) {
        callback && callback();
        return false;
      }
      clearScreenDown(callback) {
        callback && callback();
        return false;
      }
      cursorTo(x, y, callback) {
        callback && typeof callback === "function" && callback();
        return false;
      }
      moveCursor(dx, dy, callback) {
        callback && callback();
        return false;
      }
      getColorDepth(env2) {
        return 1;
      }
      hasColors(count3, env2) {
        return false;
      }
      getWindowSize() {
        return [this.columns, this.rows];
      }
      write(str, encoding, cb) {
        if (str instanceof Uint8Array) {
          str = new TextDecoder().decode(str);
        }
        try {
          console.log(str);
        } catch {
        }
        cb && typeof cb === "function" && cb();
        return false;
      }
    };
  }
});

// node_modules/unenv/dist/runtime/node/tty.mjs
var init_tty = __esm({
  "node_modules/unenv/dist/runtime/node/tty.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_read_stream();
    init_write_stream();
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION;
var init_node_version = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    NODE_VERSION = "22.14.0";
  }
});

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";
var Process;
var init_process = __esm({
  "node_modules/unenv/dist/runtime/node/internal/process/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_tty();
    init_utils();
    init_node_version();
    Process = class _Process extends EventEmitter {
      static {
        __name(this, "Process");
      }
      env;
      hrtime;
      nextTick;
      constructor(impl) {
        super();
        this.env = impl.env;
        this.hrtime = impl.hrtime;
        this.nextTick = impl.nextTick;
        for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
          const value = this[prop];
          if (typeof value === "function") {
            this[prop] = value.bind(this);
          }
        }
      }
      // --- event emitter ---
      emitWarning(warning, type, code) {
        console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
      }
      emit(...args) {
        return super.emit(...args);
      }
      listeners(eventName) {
        return super.listeners(eventName);
      }
      // --- stdio (lazy initializers) ---
      #stdin;
      #stdout;
      #stderr;
      get stdin() {
        return this.#stdin ??= new ReadStream(0);
      }
      get stdout() {
        return this.#stdout ??= new WriteStream(1);
      }
      get stderr() {
        return this.#stderr ??= new WriteStream(2);
      }
      // --- cwd ---
      #cwd = "/";
      chdir(cwd2) {
        this.#cwd = cwd2;
      }
      cwd() {
        return this.#cwd;
      }
      // --- dummy props and getters ---
      arch = "";
      platform = "";
      argv = [];
      argv0 = "";
      execArgv = [];
      execPath = "";
      title = "";
      pid = 200;
      ppid = 100;
      get version() {
        return `v${NODE_VERSION}`;
      }
      get versions() {
        return { node: NODE_VERSION };
      }
      get allowedNodeEnvironmentFlags() {
        return /* @__PURE__ */ new Set();
      }
      get sourceMapsEnabled() {
        return false;
      }
      get debugPort() {
        return 0;
      }
      get throwDeprecation() {
        return false;
      }
      get traceDeprecation() {
        return false;
      }
      get features() {
        return {};
      }
      get release() {
        return {};
      }
      get connected() {
        return false;
      }
      get config() {
        return {};
      }
      get moduleLoadList() {
        return [];
      }
      constrainedMemory() {
        return 0;
      }
      availableMemory() {
        return 0;
      }
      uptime() {
        return 0;
      }
      resourceUsage() {
        return {};
      }
      // --- noop methods ---
      ref() {
      }
      unref() {
      }
      // --- unimplemented methods ---
      umask() {
        throw createNotImplementedError("process.umask");
      }
      getBuiltinModule() {
        return void 0;
      }
      getActiveResourcesInfo() {
        throw createNotImplementedError("process.getActiveResourcesInfo");
      }
      exit() {
        throw createNotImplementedError("process.exit");
      }
      reallyExit() {
        throw createNotImplementedError("process.reallyExit");
      }
      kill() {
        throw createNotImplementedError("process.kill");
      }
      abort() {
        throw createNotImplementedError("process.abort");
      }
      dlopen() {
        throw createNotImplementedError("process.dlopen");
      }
      setSourceMapsEnabled() {
        throw createNotImplementedError("process.setSourceMapsEnabled");
      }
      loadEnvFile() {
        throw createNotImplementedError("process.loadEnvFile");
      }
      disconnect() {
        throw createNotImplementedError("process.disconnect");
      }
      cpuUsage() {
        throw createNotImplementedError("process.cpuUsage");
      }
      setUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
      }
      hasUncaughtExceptionCaptureCallback() {
        throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
      }
      initgroups() {
        throw createNotImplementedError("process.initgroups");
      }
      openStdin() {
        throw createNotImplementedError("process.openStdin");
      }
      assert() {
        throw createNotImplementedError("process.assert");
      }
      binding() {
        throw createNotImplementedError("process.binding");
      }
      // --- attached interfaces ---
      permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
      report = {
        directory: "",
        filename: "",
        signal: "SIGUSR2",
        compact: false,
        reportOnFatalError: false,
        reportOnSignal: false,
        reportOnUncaughtException: false,
        getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
        writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
      };
      finalization = {
        register: /* @__PURE__ */ notImplemented("process.finalization.register"),
        unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
        registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
      };
      memoryUsage = Object.assign(() => ({
        arrayBuffers: 0,
        rss: 0,
        external: 0,
        heapTotal: 0,
        heapUsed: 0
      }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
      // --- undefined props ---
      mainModule = void 0;
      domain = void 0;
      // optional
      send = void 0;
      exitCode = void 0;
      channel = void 0;
      getegid = void 0;
      geteuid = void 0;
      getgid = void 0;
      getgroups = void 0;
      getuid = void 0;
      setegid = void 0;
      seteuid = void 0;
      setgid = void 0;
      setgroups = void 0;
      setuid = void 0;
      // internals
      _events = void 0;
      _eventsCount = void 0;
      _exiting = void 0;
      _maxListeners = void 0;
      _debugEnd = void 0;
      _debugProcess = void 0;
      _fatalException = void 0;
      _getActiveHandles = void 0;
      _getActiveRequests = void 0;
      _kill = void 0;
      _preload_modules = void 0;
      _rawDebug = void 0;
      _startProfilerIdleNotifier = void 0;
      _stopProfilerIdleNotifier = void 0;
      _tickCallback = void 0;
      _disconnect = void 0;
      _handleQueue = void 0;
      _pendingMessage = void 0;
      _channel = void 0;
      _send = void 0;
      _linkedBinding = void 0;
    };
  }
});

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess, getBuiltinModule, workerdProcess, unenvProcess, exit, features, platform, _channel, _debugEnd, _debugProcess, _disconnect, _events, _eventsCount, _exiting, _fatalException, _getActiveHandles, _getActiveRequests, _handleQueue, _kill, _linkedBinding, _maxListeners, _pendingMessage, _preload_modules, _rawDebug, _send, _startProfilerIdleNotifier, _stopProfilerIdleNotifier, _tickCallback, abort, addListener, allowedNodeEnvironmentFlags, arch, argv, argv0, assert2, availableMemory, binding, channel, chdir, config, connected, constrainedMemory, cpuUsage, cwd, debugPort, disconnect, dlopen, domain, emit, emitWarning, env, eventNames, execArgv, execPath, exitCode, finalization, getActiveResourcesInfo, getegid, geteuid, getgid, getgroups, getMaxListeners, getuid, hasUncaughtExceptionCaptureCallback, hrtime3, initgroups, kill, listenerCount, listeners, loadEnvFile, mainModule, memoryUsage, moduleLoadList, nextTick, off, on, once, openStdin, permission, pid, ppid, prependListener, prependOnceListener, rawListeners, reallyExit, ref, release, removeAllListeners, removeListener, report, resourceUsage, send, setegid, seteuid, setgid, setgroups, setMaxListeners, setSourceMapsEnabled, setuid, setUncaughtExceptionCaptureCallback, sourceMapsEnabled, stderr, stdin, stdout, throwDeprecation, title, traceDeprecation, umask, unref, uptime, version, versions, _process, process_default;
var init_process2 = __esm({
  "node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    init_hrtime();
    init_process();
    globalProcess = globalThis["process"];
    getBuiltinModule = globalProcess.getBuiltinModule;
    workerdProcess = getBuiltinModule("node:process");
    unenvProcess = new Process({
      env: globalProcess.env,
      hrtime,
      // `nextTick` is available from workerd process v1
      nextTick: workerdProcess.nextTick
    });
    ({ exit, features, platform } = workerdProcess);
    ({
      _channel,
      _debugEnd,
      _debugProcess,
      _disconnect,
      _events,
      _eventsCount,
      _exiting,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _handleQueue,
      _kill,
      _linkedBinding,
      _maxListeners,
      _pendingMessage,
      _preload_modules,
      _rawDebug,
      _send,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      arch,
      argv,
      argv0,
      assert: assert2,
      availableMemory,
      binding,
      channel,
      chdir,
      config,
      connected,
      constrainedMemory,
      cpuUsage,
      cwd,
      debugPort,
      disconnect,
      dlopen,
      domain,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exitCode,
      finalization,
      getActiveResourcesInfo,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getMaxListeners,
      getuid,
      hasUncaughtExceptionCaptureCallback,
      hrtime: hrtime3,
      initgroups,
      kill,
      listenerCount,
      listeners,
      loadEnvFile,
      mainModule,
      memoryUsage,
      moduleLoadList,
      nextTick,
      off,
      on,
      once,
      openStdin,
      permission,
      pid,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      reallyExit,
      ref,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      send,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setMaxListeners,
      setSourceMapsEnabled,
      setuid,
      setUncaughtExceptionCaptureCallback,
      sourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      throwDeprecation,
      title,
      traceDeprecation,
      umask,
      unref,
      uptime,
      version,
      versions
    } = unenvProcess);
    _process = {
      abort,
      addListener,
      allowedNodeEnvironmentFlags,
      hasUncaughtExceptionCaptureCallback,
      setUncaughtExceptionCaptureCallback,
      loadEnvFile,
      sourceMapsEnabled,
      arch,
      argv,
      argv0,
      chdir,
      config,
      connected,
      constrainedMemory,
      availableMemory,
      cpuUsage,
      cwd,
      debugPort,
      dlopen,
      disconnect,
      emit,
      emitWarning,
      env,
      eventNames,
      execArgv,
      execPath,
      exit,
      finalization,
      features,
      getBuiltinModule,
      getActiveResourcesInfo,
      getMaxListeners,
      hrtime: hrtime3,
      kill,
      listeners,
      listenerCount,
      memoryUsage,
      nextTick,
      on,
      off,
      once,
      pid,
      platform,
      ppid,
      prependListener,
      prependOnceListener,
      rawListeners,
      release,
      removeAllListeners,
      removeListener,
      report,
      resourceUsage,
      setMaxListeners,
      setSourceMapsEnabled,
      stderr,
      stdin,
      stdout,
      title,
      throwDeprecation,
      traceDeprecation,
      umask,
      uptime,
      version,
      versions,
      // @ts-expect-error old API
      domain,
      initgroups,
      moduleLoadList,
      reallyExit,
      openStdin,
      assert: assert2,
      binding,
      send,
      exitCode,
      channel,
      getegid,
      geteuid,
      getgid,
      getgroups,
      getuid,
      setegid,
      seteuid,
      setgid,
      setgroups,
      setuid,
      permission,
      mainModule,
      _events,
      _eventsCount,
      _exiting,
      _maxListeners,
      _debugEnd,
      _debugProcess,
      _fatalException,
      _getActiveHandles,
      _getActiveRequests,
      _kill,
      _preload_modules,
      _rawDebug,
      _startProfilerIdleNotifier,
      _stopProfilerIdleNotifier,
      _tickCallback,
      _disconnect,
      _handleQueue,
      _pendingMessage,
      _channel,
      _send,
      _linkedBinding
    };
    process_default = _process;
  }
});

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
var init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process = __esm({
  "node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process"() {
    init_process2();
    globalThis.process = process_default;
  }
});

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// src/worker/rate-limiter.ts
var rate_limiter_exports = {};
__export(rate_limiter_exports, {
  RateLimits: () => RateLimits,
  cleanupRateLimits: () => cleanupRateLimits,
  rateLimiter: () => rateLimiter
});
function rateLimiter(config2) {
  const { windowMs, maxRequests, message = "Too many requests, please try again later" } = config2;
  return async (c, next) => {
    const identifier = getIdentifier(c);
    const key = `${c.req.path}:${identifier}`;
    const now = Date.now();
    let record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
    }
    record.count++;
    rateLimitStore.set(key, record);
    if (record.count > maxRequests) {
      const resetIn = Math.ceil((record.resetTime - now) / 1e3);
      c.header("Retry-After", resetIn.toString());
      c.header("X-RateLimit-Limit", maxRequests.toString());
      c.header("X-RateLimit-Remaining", "0");
      c.header("X-RateLimit-Reset", record.resetTime.toString());
      return c.json({ error: message, retryAfter: resetIn }, 429);
    }
    c.header("X-RateLimit-Limit", maxRequests.toString());
    c.header("X-RateLimit-Remaining", (maxRequests - record.count).toString());
    c.header("X-RateLimit-Reset", record.resetTime.toString());
    await next();
  };
}
function getIdentifier(c) {
  const user = c.get("user");
  if (user?.id) {
    return `user:${user.id}`;
  }
  const cfConnectingIp = c.req.header("CF-Connecting-IP");
  if (cfConnectingIp) {
    return `ip:${cfConnectingIp}`;
  }
  const xForwardedFor = c.req.header("X-Forwarded-For");
  if (xForwardedFor) {
    return `ip:${xForwardedFor.split(",")[0].trim()}`;
  }
  return "ip:unknown";
}
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}
var rateLimitStore, RateLimits;
var init_rate_limiter = __esm({
  "src/worker/rate-limiter.ts"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    rateLimitStore = /* @__PURE__ */ new Map();
    __name(rateLimiter, "rateLimiter");
    __name(getIdentifier, "getIdentifier");
    __name(cleanupRateLimits, "cleanupRateLimits");
    RateLimits = {
      // Very strict - for sensitive operations
      STRICT: { windowMs: 15 * 60 * 1e3, maxRequests: 5 },
      // 5 per 15 minutes
      // Auth operations
      AUTH: { windowMs: 15 * 60 * 1e3, maxRequests: 10 },
      // 10 per 15 minutes
      // Upload operations
      UPLOAD: { windowMs: 60 * 60 * 1e3, maxRequests: 20 },
      // 20 per hour
      // API calls
      API: { windowMs: 15 * 60 * 1e3, maxRequests: 100 },
      // 100 per 15 minutes
      // Search operations
      SEARCH: { windowMs: 60 * 1e3, maxRequests: 30 },
      // 30 per minute
      // General requests
      GENERAL: { windowMs: 60 * 1e3, maxRequests: 60 }
      // 60 per minute
    };
  }
});

// node_modules/es-errors/type.js
var require_type = __commonJS({
  "node_modules/es-errors/type.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = TypeError;
  }
});

// (disabled):node_modules/object-inspect/util.inspect
var require_util = __commonJS({
  "(disabled):node_modules/object-inspect/util.inspect"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
  }
});

// node_modules/object-inspect/index.js
var require_object_inspect = __commonJS({
  "node_modules/object-inspect/index.js"(exports, module) {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var hasMap = typeof Map === "function" && Map.prototype;
    var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
    var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
    var mapForEach = hasMap && Map.prototype.forEach;
    var hasSet = typeof Set === "function" && Set.prototype;
    var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
    var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
    var setForEach = hasSet && Set.prototype.forEach;
    var hasWeakMap = typeof WeakMap === "function" && WeakMap.prototype;
    var weakMapHas = hasWeakMap ? WeakMap.prototype.has : null;
    var hasWeakSet = typeof WeakSet === "function" && WeakSet.prototype;
    var weakSetHas = hasWeakSet ? WeakSet.prototype.has : null;
    var hasWeakRef = typeof WeakRef === "function" && WeakRef.prototype;
    var weakRefDeref = hasWeakRef ? WeakRef.prototype.deref : null;
    var booleanValueOf = Boolean.prototype.valueOf;
    var objectToString = Object.prototype.toString;
    var functionToString = Function.prototype.toString;
    var $match = String.prototype.match;
    var $slice = String.prototype.slice;
    var $replace = String.prototype.replace;
    var $toUpperCase = String.prototype.toUpperCase;
    var $toLowerCase = String.prototype.toLowerCase;
    var $test = RegExp.prototype.test;
    var $concat = Array.prototype.concat;
    var $join = Array.prototype.join;
    var $arrSlice = Array.prototype.slice;
    var $floor = Math.floor;
    var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
    var gOPS = Object.getOwnPropertySymbols;
    var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
    var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
    var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
    var isEnumerable = Object.prototype.propertyIsEnumerable;
    var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
      return O.__proto__;
    } : null);
    function addNumericSeparator(num, str) {
      if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) {
        return str;
      }
      var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
      if (typeof num === "number") {
        var int = num < 0 ? -$floor(-num) : $floor(num);
        if (int !== num) {
          var intStr = String(int);
          var dec = $slice.call(str, intStr.length + 1);
          return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
        }
      }
      return $replace.call(str, sepRegex, "$&_");
    }
    __name(addNumericSeparator, "addNumericSeparator");
    var utilInspect = require_util();
    var inspectCustom = utilInspect.custom;
    var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
    var quotes = {
      __proto__: null,
      "double": '"',
      single: "'"
    };
    var quoteREs = {
      __proto__: null,
      "double": /(["\\])/g,
      single: /(['\\])/g
    };
    module.exports = /* @__PURE__ */ __name(function inspect_(obj, options, depth, seen) {
      var opts = options || {};
      if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) {
        throw new TypeError('option "quoteStyle" must be "single" or "double"');
      }
      if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) {
        throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
      }
      var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
      if (typeof customInspect !== "boolean" && customInspect !== "symbol") {
        throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
      }
      if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) {
        throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
      }
      if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") {
        throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
      }
      var numericSeparator = opts.numericSeparator;
      if (typeof obj === "undefined") {
        return "undefined";
      }
      if (obj === null) {
        return "null";
      }
      if (typeof obj === "boolean") {
        return obj ? "true" : "false";
      }
      if (typeof obj === "string") {
        return inspectString(obj, opts);
      }
      if (typeof obj === "number") {
        if (obj === 0) {
          return Infinity / obj > 0 ? "0" : "-0";
        }
        var str = String(obj);
        return numericSeparator ? addNumericSeparator(obj, str) : str;
      }
      if (typeof obj === "bigint") {
        var bigIntStr = String(obj) + "n";
        return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
      }
      var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
      if (typeof depth === "undefined") {
        depth = 0;
      }
      if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") {
        return isArray(obj) ? "[Array]" : "[Object]";
      }
      var indent = getIndent(opts, depth);
      if (typeof seen === "undefined") {
        seen = [];
      } else if (indexOf(seen, obj) >= 0) {
        return "[Circular]";
      }
      function inspect(value, from, noIndent) {
        if (from) {
          seen = $arrSlice.call(seen);
          seen.push(from);
        }
        if (noIndent) {
          var newOpts = {
            depth: opts.depth
          };
          if (has(opts, "quoteStyle")) {
            newOpts.quoteStyle = opts.quoteStyle;
          }
          return inspect_(value, newOpts, depth + 1, seen);
        }
        return inspect_(value, opts, depth + 1, seen);
      }
      __name(inspect, "inspect");
      if (typeof obj === "function" && !isRegExp(obj)) {
        var name = nameOf(obj);
        var keys = arrObjKeys(obj, inspect);
        return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
      }
      if (isSymbol(obj)) {
        var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
        return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
      }
      if (isElement(obj)) {
        var s = "<" + $toLowerCase.call(String(obj.nodeName));
        var attrs = obj.attributes || [];
        for (var i = 0; i < attrs.length; i++) {
          s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
        }
        s += ">";
        if (obj.childNodes && obj.childNodes.length) {
          s += "...";
        }
        s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
        return s;
      }
      if (isArray(obj)) {
        if (obj.length === 0) {
          return "[]";
        }
        var xs = arrObjKeys(obj, inspect);
        if (indent && !singleLineValues(xs)) {
          return "[" + indentedJoin(xs, indent) + "]";
        }
        return "[ " + $join.call(xs, ", ") + " ]";
      }
      if (isError(obj)) {
        var parts = arrObjKeys(obj, inspect);
        if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) {
          return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect(obj.cause), parts), ", ") + " }";
        }
        if (parts.length === 0) {
          return "[" + String(obj) + "]";
        }
        return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
      }
      if (typeof obj === "object" && customInspect) {
        if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) {
          return utilInspect(obj, { depth: maxDepth - depth });
        } else if (customInspect !== "symbol" && typeof obj.inspect === "function") {
          return obj.inspect();
        }
      }
      if (isMap(obj)) {
        var mapParts = [];
        if (mapForEach) {
          mapForEach.call(obj, function(value, key) {
            mapParts.push(inspect(key, obj, true) + " => " + inspect(value, obj));
          });
        }
        return collectionOf("Map", mapSize.call(obj), mapParts, indent);
      }
      if (isSet(obj)) {
        var setParts = [];
        if (setForEach) {
          setForEach.call(obj, function(value) {
            setParts.push(inspect(value, obj));
          });
        }
        return collectionOf("Set", setSize.call(obj), setParts, indent);
      }
      if (isWeakMap(obj)) {
        return weakCollectionOf("WeakMap");
      }
      if (isWeakSet(obj)) {
        return weakCollectionOf("WeakSet");
      }
      if (isWeakRef(obj)) {
        return weakCollectionOf("WeakRef");
      }
      if (isNumber(obj)) {
        return markBoxed(inspect(Number(obj)));
      }
      if (isBigInt(obj)) {
        return markBoxed(inspect(bigIntValueOf.call(obj)));
      }
      if (isBoolean(obj)) {
        return markBoxed(booleanValueOf.call(obj));
      }
      if (isString(obj)) {
        return markBoxed(inspect(String(obj)));
      }
      if (typeof window !== "undefined" && obj === window) {
        return "{ [object Window] }";
      }
      if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) {
        return "{ [object globalThis] }";
      }
      if (!isDate(obj) && !isRegExp(obj)) {
        var ys = arrObjKeys(obj, inspect);
        var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
        var protoTag = obj instanceof Object ? "" : "null prototype";
        var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
        var constructorTag = isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "";
        var tag = constructorTag + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
        if (ys.length === 0) {
          return tag + "{}";
        }
        if (indent) {
          return tag + "{" + indentedJoin(ys, indent) + "}";
        }
        return tag + "{ " + $join.call(ys, ", ") + " }";
      }
      return String(obj);
    }, "inspect_");
    function wrapQuotes(s, defaultStyle, opts) {
      var style = opts.quoteStyle || defaultStyle;
      var quoteChar = quotes[style];
      return quoteChar + s + quoteChar;
    }
    __name(wrapQuotes, "wrapQuotes");
    function quote(s) {
      return $replace.call(String(s), /"/g, "&quot;");
    }
    __name(quote, "quote");
    function canTrustToString(obj) {
      return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
    }
    __name(canTrustToString, "canTrustToString");
    function isArray(obj) {
      return toStr(obj) === "[object Array]" && canTrustToString(obj);
    }
    __name(isArray, "isArray");
    function isDate(obj) {
      return toStr(obj) === "[object Date]" && canTrustToString(obj);
    }
    __name(isDate, "isDate");
    function isRegExp(obj) {
      return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
    }
    __name(isRegExp, "isRegExp");
    function isError(obj) {
      return toStr(obj) === "[object Error]" && canTrustToString(obj);
    }
    __name(isError, "isError");
    function isString(obj) {
      return toStr(obj) === "[object String]" && canTrustToString(obj);
    }
    __name(isString, "isString");
    function isNumber(obj) {
      return toStr(obj) === "[object Number]" && canTrustToString(obj);
    }
    __name(isNumber, "isNumber");
    function isBoolean(obj) {
      return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
    }
    __name(isBoolean, "isBoolean");
    function isSymbol(obj) {
      if (hasShammedSymbols) {
        return obj && typeof obj === "object" && obj instanceof Symbol;
      }
      if (typeof obj === "symbol") {
        return true;
      }
      if (!obj || typeof obj !== "object" || !symToString) {
        return false;
      }
      try {
        symToString.call(obj);
        return true;
      } catch (e) {
      }
      return false;
    }
    __name(isSymbol, "isSymbol");
    function isBigInt(obj) {
      if (!obj || typeof obj !== "object" || !bigIntValueOf) {
        return false;
      }
      try {
        bigIntValueOf.call(obj);
        return true;
      } catch (e) {
      }
      return false;
    }
    __name(isBigInt, "isBigInt");
    var hasOwn = Object.prototype.hasOwnProperty || function(key) {
      return key in this;
    };
    function has(obj, key) {
      return hasOwn.call(obj, key);
    }
    __name(has, "has");
    function toStr(obj) {
      return objectToString.call(obj);
    }
    __name(toStr, "toStr");
    function nameOf(f) {
      if (f.name) {
        return f.name;
      }
      var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
      if (m) {
        return m[1];
      }
      return null;
    }
    __name(nameOf, "nameOf");
    function indexOf(xs, x) {
      if (xs.indexOf) {
        return xs.indexOf(x);
      }
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) {
          return i;
        }
      }
      return -1;
    }
    __name(indexOf, "indexOf");
    function isMap(x) {
      if (!mapSize || !x || typeof x !== "object") {
        return false;
      }
      try {
        mapSize.call(x);
        try {
          setSize.call(x);
        } catch (s) {
          return true;
        }
        return x instanceof Map;
      } catch (e) {
      }
      return false;
    }
    __name(isMap, "isMap");
    function isWeakMap(x) {
      if (!weakMapHas || !x || typeof x !== "object") {
        return false;
      }
      try {
        weakMapHas.call(x, weakMapHas);
        try {
          weakSetHas.call(x, weakSetHas);
        } catch (s) {
          return true;
        }
        return x instanceof WeakMap;
      } catch (e) {
      }
      return false;
    }
    __name(isWeakMap, "isWeakMap");
    function isWeakRef(x) {
      if (!weakRefDeref || !x || typeof x !== "object") {
        return false;
      }
      try {
        weakRefDeref.call(x);
        return true;
      } catch (e) {
      }
      return false;
    }
    __name(isWeakRef, "isWeakRef");
    function isSet(x) {
      if (!setSize || !x || typeof x !== "object") {
        return false;
      }
      try {
        setSize.call(x);
        try {
          mapSize.call(x);
        } catch (m) {
          return true;
        }
        return x instanceof Set;
      } catch (e) {
      }
      return false;
    }
    __name(isSet, "isSet");
    function isWeakSet(x) {
      if (!weakSetHas || !x || typeof x !== "object") {
        return false;
      }
      try {
        weakSetHas.call(x, weakSetHas);
        try {
          weakMapHas.call(x, weakMapHas);
        } catch (s) {
          return true;
        }
        return x instanceof WeakSet;
      } catch (e) {
      }
      return false;
    }
    __name(isWeakSet, "isWeakSet");
    function isElement(x) {
      if (!x || typeof x !== "object") {
        return false;
      }
      if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) {
        return true;
      }
      return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
    }
    __name(isElement, "isElement");
    function inspectString(str, opts) {
      if (str.length > opts.maxStringLength) {
        var remaining = str.length - opts.maxStringLength;
        var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
        return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
      }
      var quoteRE = quoteREs[opts.quoteStyle || "single"];
      quoteRE.lastIndex = 0;
      var s = $replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte);
      return wrapQuotes(s, "single", opts);
    }
    __name(inspectString, "inspectString");
    function lowbyte(c) {
      var n = c.charCodeAt(0);
      var x = {
        8: "b",
        9: "t",
        10: "n",
        12: "f",
        13: "r"
      }[n];
      if (x) {
        return "\\" + x;
      }
      return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
    }
    __name(lowbyte, "lowbyte");
    function markBoxed(str) {
      return "Object(" + str + ")";
    }
    __name(markBoxed, "markBoxed");
    function weakCollectionOf(type) {
      return type + " { ? }";
    }
    __name(weakCollectionOf, "weakCollectionOf");
    function collectionOf(type, size, entries, indent) {
      var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
      return type + " (" + size + ") {" + joinedEntries + "}";
    }
    __name(collectionOf, "collectionOf");
    function singleLineValues(xs) {
      for (var i = 0; i < xs.length; i++) {
        if (indexOf(xs[i], "\n") >= 0) {
          return false;
        }
      }
      return true;
    }
    __name(singleLineValues, "singleLineValues");
    function getIndent(opts, depth) {
      var baseIndent;
      if (opts.indent === "	") {
        baseIndent = "	";
      } else if (typeof opts.indent === "number" && opts.indent > 0) {
        baseIndent = $join.call(Array(opts.indent + 1), " ");
      } else {
        return null;
      }
      return {
        base: baseIndent,
        prev: $join.call(Array(depth + 1), baseIndent)
      };
    }
    __name(getIndent, "getIndent");
    function indentedJoin(xs, indent) {
      if (xs.length === 0) {
        return "";
      }
      var lineJoiner = "\n" + indent.prev + indent.base;
      return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
    }
    __name(indentedJoin, "indentedJoin");
    function arrObjKeys(obj, inspect) {
      var isArr = isArray(obj);
      var xs = [];
      if (isArr) {
        xs.length = obj.length;
        for (var i = 0; i < obj.length; i++) {
          xs[i] = has(obj, i) ? inspect(obj[i], obj) : "";
        }
      }
      var syms = typeof gOPS === "function" ? gOPS(obj) : [];
      var symMap;
      if (hasShammedSymbols) {
        symMap = {};
        for (var k = 0; k < syms.length; k++) {
          symMap["$" + syms[k]] = syms[k];
        }
      }
      for (var key in obj) {
        if (!has(obj, key)) {
          continue;
        }
        if (isArr && String(Number(key)) === key && key < obj.length) {
          continue;
        }
        if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) {
          continue;
        } else if ($test.call(/[^\w$]/, key)) {
          xs.push(inspect(key, obj) + ": " + inspect(obj[key], obj));
        } else {
          xs.push(key + ": " + inspect(obj[key], obj));
        }
      }
      if (typeof gOPS === "function") {
        for (var j = 0; j < syms.length; j++) {
          if (isEnumerable.call(obj, syms[j])) {
            xs.push("[" + inspect(syms[j]) + "]: " + inspect(obj[syms[j]], obj));
          }
        }
      }
      return xs;
    }
    __name(arrObjKeys, "arrObjKeys");
  }
});

// node_modules/side-channel-list/index.js
var require_side_channel_list = __commonJS({
  "node_modules/side-channel-list/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var inspect = require_object_inspect();
    var $TypeError = require_type();
    var listGetNode = /* @__PURE__ */ __name(function(list, key, isDelete) {
      var prev = list;
      var curr;
      for (; (curr = prev.next) != null; prev = curr) {
        if (curr.key === key) {
          prev.next = curr.next;
          if (!isDelete) {
            curr.next = /** @type {NonNullable<typeof list.next>} */
            list.next;
            list.next = curr;
          }
          return curr;
        }
      }
    }, "listGetNode");
    var listGet = /* @__PURE__ */ __name(function(objects, key) {
      if (!objects) {
        return void 0;
      }
      var node = listGetNode(objects, key);
      return node && node.value;
    }, "listGet");
    var listSet = /* @__PURE__ */ __name(function(objects, key, value) {
      var node = listGetNode(objects, key);
      if (node) {
        node.value = value;
      } else {
        objects.next = /** @type {import('./list.d.ts').ListNode<typeof value, typeof key>} */
        {
          // eslint-disable-line no-param-reassign, no-extra-parens
          key,
          next: objects.next,
          value
        };
      }
    }, "listSet");
    var listHas = /* @__PURE__ */ __name(function(objects, key) {
      if (!objects) {
        return false;
      }
      return !!listGetNode(objects, key);
    }, "listHas");
    var listDelete = /* @__PURE__ */ __name(function(objects, key) {
      if (objects) {
        return listGetNode(objects, key, true);
      }
    }, "listDelete");
    module.exports = /* @__PURE__ */ __name(function getSideChannelList() {
      var $o;
      var channel2 = {
        assert: /* @__PURE__ */ __name(function(key) {
          if (!channel2.has(key)) {
            throw new $TypeError("Side channel does not contain " + inspect(key));
          }
        }, "assert"),
        "delete": /* @__PURE__ */ __name(function(key) {
          var deletedNode = listDelete($o, key);
          if (deletedNode && $o && !$o.next) {
            $o = void 0;
          }
          return !!deletedNode;
        }, "delete"),
        get: /* @__PURE__ */ __name(function(key) {
          return listGet($o, key);
        }, "get"),
        has: /* @__PURE__ */ __name(function(key) {
          return listHas($o, key);
        }, "has"),
        set: /* @__PURE__ */ __name(function(key, value) {
          if (!$o) {
            $o = {
              next: void 0
            };
          }
          listSet(
            /** @type {NonNullable<typeof $o>} */
            $o,
            key,
            value
          );
        }, "set")
      };
      return channel2;
    }, "getSideChannelList");
  }
});

// node_modules/es-object-atoms/index.js
var require_es_object_atoms = __commonJS({
  "node_modules/es-object-atoms/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Object;
  }
});

// node_modules/es-errors/index.js
var require_es_errors = __commonJS({
  "node_modules/es-errors/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Error;
  }
});

// node_modules/es-errors/eval.js
var require_eval = __commonJS({
  "node_modules/es-errors/eval.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = EvalError;
  }
});

// node_modules/es-errors/range.js
var require_range = __commonJS({
  "node_modules/es-errors/range.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = RangeError;
  }
});

// node_modules/es-errors/ref.js
var require_ref = __commonJS({
  "node_modules/es-errors/ref.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = ReferenceError;
  }
});

// node_modules/es-errors/syntax.js
var require_syntax = __commonJS({
  "node_modules/es-errors/syntax.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = SyntaxError;
  }
});

// node_modules/es-errors/uri.js
var require_uri = __commonJS({
  "node_modules/es-errors/uri.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = URIError;
  }
});

// node_modules/math-intrinsics/abs.js
var require_abs = __commonJS({
  "node_modules/math-intrinsics/abs.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.abs;
  }
});

// node_modules/math-intrinsics/floor.js
var require_floor = __commonJS({
  "node_modules/math-intrinsics/floor.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.floor;
  }
});

// node_modules/math-intrinsics/max.js
var require_max = __commonJS({
  "node_modules/math-intrinsics/max.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.max;
  }
});

// node_modules/math-intrinsics/min.js
var require_min = __commonJS({
  "node_modules/math-intrinsics/min.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.min;
  }
});

// node_modules/math-intrinsics/pow.js
var require_pow = __commonJS({
  "node_modules/math-intrinsics/pow.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.pow;
  }
});

// node_modules/math-intrinsics/round.js
var require_round = __commonJS({
  "node_modules/math-intrinsics/round.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Math.round;
  }
});

// node_modules/math-intrinsics/isNaN.js
var require_isNaN = __commonJS({
  "node_modules/math-intrinsics/isNaN.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Number.isNaN || /* @__PURE__ */ __name(function isNaN2(a) {
      return a !== a;
    }, "isNaN");
  }
});

// node_modules/math-intrinsics/sign.js
var require_sign = __commonJS({
  "node_modules/math-intrinsics/sign.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var $isNaN = require_isNaN();
    module.exports = /* @__PURE__ */ __name(function sign(number) {
      if ($isNaN(number) || number === 0) {
        return number;
      }
      return number < 0 ? -1 : 1;
    }, "sign");
  }
});

// node_modules/gopd/gOPD.js
var require_gOPD = __commonJS({
  "node_modules/gopd/gOPD.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Object.getOwnPropertyDescriptor;
  }
});

// node_modules/gopd/index.js
var require_gopd = __commonJS({
  "node_modules/gopd/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var $gOPD = require_gOPD();
    if ($gOPD) {
      try {
        $gOPD([], "length");
      } catch (e) {
        $gOPD = null;
      }
    }
    module.exports = $gOPD;
  }
});

// node_modules/es-define-property/index.js
var require_es_define_property = __commonJS({
  "node_modules/es-define-property/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var $defineProperty = Object.defineProperty || false;
    if ($defineProperty) {
      try {
        $defineProperty({}, "a", { value: 1 });
      } catch (e) {
        $defineProperty = false;
      }
    }
    module.exports = $defineProperty;
  }
});

// node_modules/has-symbols/shams.js
var require_shams = __commonJS({
  "node_modules/has-symbols/shams.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = /* @__PURE__ */ __name(function hasSymbols() {
      if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
        return false;
      }
      if (typeof Symbol.iterator === "symbol") {
        return true;
      }
      var obj = {};
      var sym = /* @__PURE__ */ Symbol("test");
      var symObj = Object(sym);
      if (typeof sym === "string") {
        return false;
      }
      if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
        return false;
      }
      if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
        return false;
      }
      var symVal = 42;
      obj[sym] = symVal;
      for (var _ in obj) {
        return false;
      }
      if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
        return false;
      }
      if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
        return false;
      }
      var syms = Object.getOwnPropertySymbols(obj);
      if (syms.length !== 1 || syms[0] !== sym) {
        return false;
      }
      if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
        return false;
      }
      if (typeof Object.getOwnPropertyDescriptor === "function") {
        var descriptor = (
          /** @type {PropertyDescriptor} */
          Object.getOwnPropertyDescriptor(obj, sym)
        );
        if (descriptor.value !== symVal || descriptor.enumerable !== true) {
          return false;
        }
      }
      return true;
    }, "hasSymbols");
  }
});

// node_modules/has-symbols/index.js
var require_has_symbols = __commonJS({
  "node_modules/has-symbols/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var origSymbol = typeof Symbol !== "undefined" && Symbol;
    var hasSymbolSham = require_shams();
    module.exports = /* @__PURE__ */ __name(function hasNativeSymbols() {
      if (typeof origSymbol !== "function") {
        return false;
      }
      if (typeof Symbol !== "function") {
        return false;
      }
      if (typeof origSymbol("foo") !== "symbol") {
        return false;
      }
      if (typeof /* @__PURE__ */ Symbol("bar") !== "symbol") {
        return false;
      }
      return hasSymbolSham();
    }, "hasNativeSymbols");
  }
});

// node_modules/get-proto/Reflect.getPrototypeOf.js
var require_Reflect_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Reflect.getPrototypeOf.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = typeof Reflect !== "undefined" && Reflect.getPrototypeOf || null;
  }
});

// node_modules/get-proto/Object.getPrototypeOf.js
var require_Object_getPrototypeOf = __commonJS({
  "node_modules/get-proto/Object.getPrototypeOf.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var $Object = require_es_object_atoms();
    module.exports = $Object.getPrototypeOf || null;
  }
});

// node_modules/function-bind/implementation.js
var require_implementation = __commonJS({
  "node_modules/function-bind/implementation.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
    var toStr = Object.prototype.toString;
    var max = Math.max;
    var funcType = "[object Function]";
    var concatty = /* @__PURE__ */ __name(function concatty2(a, b) {
      var arr = [];
      for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
      }
      for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
      }
      return arr;
    }, "concatty");
    var slicy = /* @__PURE__ */ __name(function slicy2(arrLike, offset) {
      var arr = [];
      for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
      }
      return arr;
    }, "slicy");
    var joiny = /* @__PURE__ */ __name(function(arr, joiner) {
      var str = "";
      for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
          str += joiner;
        }
      }
      return str;
    }, "joiny");
    module.exports = /* @__PURE__ */ __name(function bind(that) {
      var target = this;
      if (typeof target !== "function" || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
      }
      var args = slicy(arguments, 1);
      var bound;
      var binder = /* @__PURE__ */ __name(function() {
        if (this instanceof bound) {
          var result = target.apply(
            this,
            concatty(args, arguments)
          );
          if (Object(result) === result) {
            return result;
          }
          return this;
        }
        return target.apply(
          that,
          concatty(args, arguments)
        );
      }, "binder");
      var boundLength = max(0, target.length - args.length);
      var boundArgs = [];
      for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = "$" + i;
      }
      bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
      if (target.prototype) {
        var Empty = /* @__PURE__ */ __name(function Empty2() {
        }, "Empty");
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
      }
      return bound;
    }, "bind");
  }
});

// node_modules/function-bind/index.js
var require_function_bind = __commonJS({
  "node_modules/function-bind/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var implementation = require_implementation();
    module.exports = Function.prototype.bind || implementation;
  }
});

// node_modules/call-bind-apply-helpers/functionCall.js
var require_functionCall = __commonJS({
  "node_modules/call-bind-apply-helpers/functionCall.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Function.prototype.call;
  }
});

// node_modules/call-bind-apply-helpers/functionApply.js
var require_functionApply = __commonJS({
  "node_modules/call-bind-apply-helpers/functionApply.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = Function.prototype.apply;
  }
});

// node_modules/call-bind-apply-helpers/reflectApply.js
var require_reflectApply = __commonJS({
  "node_modules/call-bind-apply-helpers/reflectApply.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    module.exports = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
  }
});

// node_modules/call-bind-apply-helpers/actualApply.js
var require_actualApply = __commonJS({
  "node_modules/call-bind-apply-helpers/actualApply.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var bind = require_function_bind();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var $reflectApply = require_reflectApply();
    module.exports = $reflectApply || bind.call($call, $apply);
  }
});

// node_modules/call-bind-apply-helpers/index.js
var require_call_bind_apply_helpers = __commonJS({
  "node_modules/call-bind-apply-helpers/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var bind = require_function_bind();
    var $TypeError = require_type();
    var $call = require_functionCall();
    var $actualApply = require_actualApply();
    module.exports = /* @__PURE__ */ __name(function callBindBasic(args) {
      if (args.length < 1 || typeof args[0] !== "function") {
        throw new $TypeError("a function is required");
      }
      return $actualApply(bind, $call, args);
    }, "callBindBasic");
  }
});

// node_modules/dunder-proto/get.js
var require_get = __commonJS({
  "node_modules/dunder-proto/get.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var callBind = require_call_bind_apply_helpers();
    var gOPD = require_gopd();
    var hasProtoAccessor;
    try {
      hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
      [].__proto__ === Array.prototype;
    } catch (e) {
      if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
        throw e;
      }
    }
    var desc = !!hasProtoAccessor && gOPD && gOPD(
      Object.prototype,
      /** @type {keyof typeof Object.prototype} */
      "__proto__"
    );
    var $Object = Object;
    var $getPrototypeOf = $Object.getPrototypeOf;
    module.exports = desc && typeof desc.get === "function" ? callBind([desc.get]) : typeof $getPrototypeOf === "function" ? (
      /** @type {import('./get')} */
      /* @__PURE__ */ __name(function getDunder(value) {
        return $getPrototypeOf(value == null ? value : $Object(value));
      }, "getDunder")
    ) : false;
  }
});

// node_modules/get-proto/index.js
var require_get_proto = __commonJS({
  "node_modules/get-proto/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var reflectGetProto = require_Reflect_getPrototypeOf();
    var originalGetProto = require_Object_getPrototypeOf();
    var getDunderProto = require_get();
    module.exports = reflectGetProto ? /* @__PURE__ */ __name(function getProto(O) {
      return reflectGetProto(O);
    }, "getProto") : originalGetProto ? /* @__PURE__ */ __name(function getProto(O) {
      if (!O || typeof O !== "object" && typeof O !== "function") {
        throw new TypeError("getProto: not an object");
      }
      return originalGetProto(O);
    }, "getProto") : getDunderProto ? /* @__PURE__ */ __name(function getProto(O) {
      return getDunderProto(O);
    }, "getProto") : null;
  }
});

// node_modules/hasown/index.js
var require_hasown = __commonJS({
  "node_modules/hasown/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var call = Function.prototype.call;
    var $hasOwn = Object.prototype.hasOwnProperty;
    var bind = require_function_bind();
    module.exports = bind.call(call, $hasOwn);
  }
});

// node_modules/get-intrinsic/index.js
var require_get_intrinsic = __commonJS({
  "node_modules/get-intrinsic/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var undefined2;
    var $Object = require_es_object_atoms();
    var $Error = require_es_errors();
    var $EvalError = require_eval();
    var $RangeError = require_range();
    var $ReferenceError = require_ref();
    var $SyntaxError = require_syntax();
    var $TypeError = require_type();
    var $URIError = require_uri();
    var abs = require_abs();
    var floor = require_floor();
    var max = require_max();
    var min = require_min();
    var pow = require_pow();
    var round = require_round();
    var sign = require_sign();
    var $Function = Function;
    var getEvalledConstructor = /* @__PURE__ */ __name(function(expressionSyntax) {
      try {
        return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
      } catch (e) {
      }
    }, "getEvalledConstructor");
    var $gOPD = require_gopd();
    var $defineProperty = require_es_define_property();
    var throwTypeError = /* @__PURE__ */ __name(function() {
      throw new $TypeError();
    }, "throwTypeError");
    var ThrowTypeError = $gOPD ? (function() {
      try {
        arguments.callee;
        return throwTypeError;
      } catch (calleeThrows) {
        try {
          return $gOPD(arguments, "callee").get;
        } catch (gOPDthrows) {
          return throwTypeError;
        }
      }
    })() : throwTypeError;
    var hasSymbols = require_has_symbols()();
    var getProto = require_get_proto();
    var $ObjectGPO = require_Object_getPrototypeOf();
    var $ReflectGPO = require_Reflect_getPrototypeOf();
    var $apply = require_functionApply();
    var $call = require_functionCall();
    var needsEval = {};
    var TypedArray = typeof Uint8Array === "undefined" || !getProto ? undefined2 : getProto(Uint8Array);
    var INTRINSICS = {
      __proto__: null,
      "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
      "%Array%": Array,
      "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
      "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
      "%AsyncFromSyncIteratorPrototype%": undefined2,
      "%AsyncFunction%": needsEval,
      "%AsyncGenerator%": needsEval,
      "%AsyncGeneratorFunction%": needsEval,
      "%AsyncIteratorPrototype%": needsEval,
      "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
      "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
      "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined2 : BigInt64Array,
      "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined2 : BigUint64Array,
      "%Boolean%": Boolean,
      "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
      "%Date%": Date,
      "%decodeURI%": decodeURI,
      "%decodeURIComponent%": decodeURIComponent,
      "%encodeURI%": encodeURI,
      "%encodeURIComponent%": encodeURIComponent,
      "%Error%": $Error,
      "%eval%": eval,
      // eslint-disable-line no-eval
      "%EvalError%": $EvalError,
      "%Float16Array%": typeof Float16Array === "undefined" ? undefined2 : Float16Array,
      "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
      "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
      "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
      "%Function%": $Function,
      "%GeneratorFunction%": needsEval,
      "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
      "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
      "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
      "%isFinite%": isFinite,
      "%isNaN%": isNaN,
      "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
      "%JSON%": typeof JSON === "object" ? JSON : undefined2,
      "%Map%": typeof Map === "undefined" ? undefined2 : Map,
      "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
      "%Math%": Math,
      "%Number%": Number,
      "%Object%": $Object,
      "%Object.getOwnPropertyDescriptor%": $gOPD,
      "%parseFloat%": parseFloat,
      "%parseInt%": parseInt,
      "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
      "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
      "%RangeError%": $RangeError,
      "%ReferenceError%": $ReferenceError,
      "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
      "%RegExp%": RegExp,
      "%Set%": typeof Set === "undefined" ? undefined2 : Set,
      "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
      "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
      "%String%": String,
      "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
      "%Symbol%": hasSymbols ? Symbol : undefined2,
      "%SyntaxError%": $SyntaxError,
      "%ThrowTypeError%": ThrowTypeError,
      "%TypedArray%": TypedArray,
      "%TypeError%": $TypeError,
      "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
      "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
      "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
      "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
      "%URIError%": $URIError,
      "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
      "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
      "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet,
      "%Function.prototype.call%": $call,
      "%Function.prototype.apply%": $apply,
      "%Object.defineProperty%": $defineProperty,
      "%Object.getPrototypeOf%": $ObjectGPO,
      "%Math.abs%": abs,
      "%Math.floor%": floor,
      "%Math.max%": max,
      "%Math.min%": min,
      "%Math.pow%": pow,
      "%Math.round%": round,
      "%Math.sign%": sign,
      "%Reflect.getPrototypeOf%": $ReflectGPO
    };
    if (getProto) {
      try {
        null.error;
      } catch (e) {
        errorProto = getProto(getProto(e));
        INTRINSICS["%Error.prototype%"] = errorProto;
      }
    }
    var errorProto;
    var doEval = /* @__PURE__ */ __name(function doEval2(name) {
      var value;
      if (name === "%AsyncFunction%") {
        value = getEvalledConstructor("async function () {}");
      } else if (name === "%GeneratorFunction%") {
        value = getEvalledConstructor("function* () {}");
      } else if (name === "%AsyncGeneratorFunction%") {
        value = getEvalledConstructor("async function* () {}");
      } else if (name === "%AsyncGenerator%") {
        var fn = doEval2("%AsyncGeneratorFunction%");
        if (fn) {
          value = fn.prototype;
        }
      } else if (name === "%AsyncIteratorPrototype%") {
        var gen = doEval2("%AsyncGenerator%");
        if (gen && getProto) {
          value = getProto(gen.prototype);
        }
      }
      INTRINSICS[name] = value;
      return value;
    }, "doEval");
    var LEGACY_ALIASES = {
      __proto__: null,
      "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
      "%ArrayPrototype%": ["Array", "prototype"],
      "%ArrayProto_entries%": ["Array", "prototype", "entries"],
      "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
      "%ArrayProto_keys%": ["Array", "prototype", "keys"],
      "%ArrayProto_values%": ["Array", "prototype", "values"],
      "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
      "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
      "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
      "%BooleanPrototype%": ["Boolean", "prototype"],
      "%DataViewPrototype%": ["DataView", "prototype"],
      "%DatePrototype%": ["Date", "prototype"],
      "%ErrorPrototype%": ["Error", "prototype"],
      "%EvalErrorPrototype%": ["EvalError", "prototype"],
      "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
      "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
      "%FunctionPrototype%": ["Function", "prototype"],
      "%Generator%": ["GeneratorFunction", "prototype"],
      "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
      "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
      "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
      "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
      "%JSONParse%": ["JSON", "parse"],
      "%JSONStringify%": ["JSON", "stringify"],
      "%MapPrototype%": ["Map", "prototype"],
      "%NumberPrototype%": ["Number", "prototype"],
      "%ObjectPrototype%": ["Object", "prototype"],
      "%ObjProto_toString%": ["Object", "prototype", "toString"],
      "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
      "%PromisePrototype%": ["Promise", "prototype"],
      "%PromiseProto_then%": ["Promise", "prototype", "then"],
      "%Promise_all%": ["Promise", "all"],
      "%Promise_reject%": ["Promise", "reject"],
      "%Promise_resolve%": ["Promise", "resolve"],
      "%RangeErrorPrototype%": ["RangeError", "prototype"],
      "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
      "%RegExpPrototype%": ["RegExp", "prototype"],
      "%SetPrototype%": ["Set", "prototype"],
      "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
      "%StringPrototype%": ["String", "prototype"],
      "%SymbolPrototype%": ["Symbol", "prototype"],
      "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
      "%TypedArrayPrototype%": ["TypedArray", "prototype"],
      "%TypeErrorPrototype%": ["TypeError", "prototype"],
      "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
      "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
      "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
      "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
      "%URIErrorPrototype%": ["URIError", "prototype"],
      "%WeakMapPrototype%": ["WeakMap", "prototype"],
      "%WeakSetPrototype%": ["WeakSet", "prototype"]
    };
    var bind = require_function_bind();
    var hasOwn = require_hasown();
    var $concat = bind.call($call, Array.prototype.concat);
    var $spliceApply = bind.call($apply, Array.prototype.splice);
    var $replace = bind.call($call, String.prototype.replace);
    var $strSlice = bind.call($call, String.prototype.slice);
    var $exec = bind.call($call, RegExp.prototype.exec);
    var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
    var reEscapeChar = /\\(\\)?/g;
    var stringToPath = /* @__PURE__ */ __name(function stringToPath2(string) {
      var first = $strSlice(string, 0, 1);
      var last = $strSlice(string, -1);
      if (first === "%" && last !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
      } else if (last === "%" && first !== "%") {
        throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
      }
      var result = [];
      $replace(string, rePropName, function(match2, number, quote, subString) {
        result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match2;
      });
      return result;
    }, "stringToPath");
    var getBaseIntrinsic = /* @__PURE__ */ __name(function getBaseIntrinsic2(name, allowMissing) {
      var intrinsicName = name;
      var alias;
      if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
        alias = LEGACY_ALIASES[intrinsicName];
        intrinsicName = "%" + alias[0] + "%";
      }
      if (hasOwn(INTRINSICS, intrinsicName)) {
        var value = INTRINSICS[intrinsicName];
        if (value === needsEval) {
          value = doEval(intrinsicName);
        }
        if (typeof value === "undefined" && !allowMissing) {
          throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!");
        }
        return {
          alias,
          name: intrinsicName,
          value
        };
      }
      throw new $SyntaxError("intrinsic " + name + " does not exist!");
    }, "getBaseIntrinsic");
    module.exports = /* @__PURE__ */ __name(function GetIntrinsic(name, allowMissing) {
      if (typeof name !== "string" || name.length === 0) {
        throw new $TypeError("intrinsic name must be a non-empty string");
      }
      if (arguments.length > 1 && typeof allowMissing !== "boolean") {
        throw new $TypeError('"allowMissing" argument must be a boolean');
      }
      if ($exec(/^%?[^%]*%?$/, name) === null) {
        throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
      }
      var parts = stringToPath(name);
      var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
      var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
      var intrinsicRealName = intrinsic.name;
      var value = intrinsic.value;
      var skipFurtherCaching = false;
      var alias = intrinsic.alias;
      if (alias) {
        intrinsicBaseName = alias[0];
        $spliceApply(parts, $concat([0, 1], alias));
      }
      for (var i = 1, isOwn = true; i < parts.length; i += 1) {
        var part = parts[i];
        var first = $strSlice(part, 0, 1);
        var last = $strSlice(part, -1);
        if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
          throw new $SyntaxError("property names with quotes must have matching quotes");
        }
        if (part === "constructor" || !isOwn) {
          skipFurtherCaching = true;
        }
        intrinsicBaseName += "." + part;
        intrinsicRealName = "%" + intrinsicBaseName + "%";
        if (hasOwn(INTRINSICS, intrinsicRealName)) {
          value = INTRINSICS[intrinsicRealName];
        } else if (value != null) {
          if (!(part in value)) {
            if (!allowMissing) {
              throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.");
            }
            return void undefined2;
          }
          if ($gOPD && i + 1 >= parts.length) {
            var desc = $gOPD(value, part);
            isOwn = !!desc;
            if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
              value = desc.get;
            } else {
              value = value[part];
            }
          } else {
            isOwn = hasOwn(value, part);
            value = value[part];
          }
          if (isOwn && !skipFurtherCaching) {
            INTRINSICS[intrinsicRealName] = value;
          }
        }
      }
      return value;
    }, "GetIntrinsic");
  }
});

// node_modules/call-bound/index.js
var require_call_bound = __commonJS({
  "node_modules/call-bound/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var GetIntrinsic = require_get_intrinsic();
    var callBindBasic = require_call_bind_apply_helpers();
    var $indexOf = callBindBasic([GetIntrinsic("%String.prototype.indexOf%")]);
    module.exports = /* @__PURE__ */ __name(function callBoundIntrinsic(name, allowMissing) {
      var intrinsic = (
        /** @type {(this: unknown, ...args: unknown[]) => unknown} */
        GetIntrinsic(name, !!allowMissing)
      );
      if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
        return callBindBasic(
          /** @type {const} */
          [intrinsic]
        );
      }
      return intrinsic;
    }, "callBoundIntrinsic");
  }
});

// node_modules/side-channel-map/index.js
var require_side_channel_map = __commonJS({
  "node_modules/side-channel-map/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var GetIntrinsic = require_get_intrinsic();
    var callBound = require_call_bound();
    var inspect = require_object_inspect();
    var $TypeError = require_type();
    var $Map = GetIntrinsic("%Map%", true);
    var $mapGet = callBound("Map.prototype.get", true);
    var $mapSet = callBound("Map.prototype.set", true);
    var $mapHas = callBound("Map.prototype.has", true);
    var $mapDelete = callBound("Map.prototype.delete", true);
    var $mapSize = callBound("Map.prototype.size", true);
    module.exports = !!$Map && /** @type {Exclude<import('.'), false>} */
    /* @__PURE__ */ __name(function getSideChannelMap() {
      var $m;
      var channel2 = {
        assert: /* @__PURE__ */ __name(function(key) {
          if (!channel2.has(key)) {
            throw new $TypeError("Side channel does not contain " + inspect(key));
          }
        }, "assert"),
        "delete": /* @__PURE__ */ __name(function(key) {
          if ($m) {
            var result = $mapDelete($m, key);
            if ($mapSize($m) === 0) {
              $m = void 0;
            }
            return result;
          }
          return false;
        }, "delete"),
        get: /* @__PURE__ */ __name(function(key) {
          if ($m) {
            return $mapGet($m, key);
          }
        }, "get"),
        has: /* @__PURE__ */ __name(function(key) {
          if ($m) {
            return $mapHas($m, key);
          }
          return false;
        }, "has"),
        set: /* @__PURE__ */ __name(function(key, value) {
          if (!$m) {
            $m = new $Map();
          }
          $mapSet($m, key, value);
        }, "set")
      };
      return channel2;
    }, "getSideChannelMap");
  }
});

// node_modules/side-channel-weakmap/index.js
var require_side_channel_weakmap = __commonJS({
  "node_modules/side-channel-weakmap/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var GetIntrinsic = require_get_intrinsic();
    var callBound = require_call_bound();
    var inspect = require_object_inspect();
    var getSideChannelMap = require_side_channel_map();
    var $TypeError = require_type();
    var $WeakMap = GetIntrinsic("%WeakMap%", true);
    var $weakMapGet = callBound("WeakMap.prototype.get", true);
    var $weakMapSet = callBound("WeakMap.prototype.set", true);
    var $weakMapHas = callBound("WeakMap.prototype.has", true);
    var $weakMapDelete = callBound("WeakMap.prototype.delete", true);
    module.exports = $WeakMap ? (
      /** @type {Exclude<import('.'), false>} */
      /* @__PURE__ */ __name(function getSideChannelWeakMap() {
        var $wm;
        var $m;
        var channel2 = {
          assert: /* @__PURE__ */ __name(function(key) {
            if (!channel2.has(key)) {
              throw new $TypeError("Side channel does not contain " + inspect(key));
            }
          }, "assert"),
          "delete": /* @__PURE__ */ __name(function(key) {
            if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
              if ($wm) {
                return $weakMapDelete($wm, key);
              }
            } else if (getSideChannelMap) {
              if ($m) {
                return $m["delete"](key);
              }
            }
            return false;
          }, "delete"),
          get: /* @__PURE__ */ __name(function(key) {
            if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
              if ($wm) {
                return $weakMapGet($wm, key);
              }
            }
            return $m && $m.get(key);
          }, "get"),
          has: /* @__PURE__ */ __name(function(key) {
            if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
              if ($wm) {
                return $weakMapHas($wm, key);
              }
            }
            return !!$m && $m.has(key);
          }, "has"),
          set: /* @__PURE__ */ __name(function(key, value) {
            if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
              if (!$wm) {
                $wm = new $WeakMap();
              }
              $weakMapSet($wm, key, value);
            } else if (getSideChannelMap) {
              if (!$m) {
                $m = getSideChannelMap();
              }
              $m.set(key, value);
            }
          }, "set")
        };
        return channel2;
      }, "getSideChannelWeakMap")
    ) : getSideChannelMap;
  }
});

// node_modules/side-channel/index.js
var require_side_channel = __commonJS({
  "node_modules/side-channel/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var $TypeError = require_type();
    var inspect = require_object_inspect();
    var getSideChannelList = require_side_channel_list();
    var getSideChannelMap = require_side_channel_map();
    var getSideChannelWeakMap = require_side_channel_weakmap();
    var makeChannel = getSideChannelWeakMap || getSideChannelMap || getSideChannelList;
    module.exports = /* @__PURE__ */ __name(function getSideChannel() {
      var $channelData;
      var channel2 = {
        assert: /* @__PURE__ */ __name(function(key) {
          if (!channel2.has(key)) {
            throw new $TypeError("Side channel does not contain " + inspect(key));
          }
        }, "assert"),
        "delete": /* @__PURE__ */ __name(function(key) {
          return !!$channelData && $channelData["delete"](key);
        }, "delete"),
        get: /* @__PURE__ */ __name(function(key) {
          return $channelData && $channelData.get(key);
        }, "get"),
        has: /* @__PURE__ */ __name(function(key) {
          return !!$channelData && $channelData.has(key);
        }, "has"),
        set: /* @__PURE__ */ __name(function(key, value) {
          if (!$channelData) {
            $channelData = makeChannel();
          }
          $channelData.set(key, value);
        }, "set")
      };
      return channel2;
    }, "getSideChannel");
  }
});

// node_modules/qs/lib/formats.js
var require_formats = __commonJS({
  "node_modules/qs/lib/formats.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var replace = String.prototype.replace;
    var percentTwenties = /%20/g;
    var Format = {
      RFC1738: "RFC1738",
      RFC3986: "RFC3986"
    };
    module.exports = {
      "default": Format.RFC3986,
      formatters: {
        RFC1738: /* @__PURE__ */ __name(function(value) {
          return replace.call(value, percentTwenties, "+");
        }, "RFC1738"),
        RFC3986: /* @__PURE__ */ __name(function(value) {
          return String(value);
        }, "RFC3986")
      },
      RFC1738: Format.RFC1738,
      RFC3986: Format.RFC3986
    };
  }
});

// node_modules/qs/lib/utils.js
var require_utils = __commonJS({
  "node_modules/qs/lib/utils.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var formats = require_formats();
    var getSideChannel = require_side_channel();
    var has = Object.prototype.hasOwnProperty;
    var isArray = Array.isArray;
    var overflowChannel = getSideChannel();
    var markOverflow = /* @__PURE__ */ __name(function markOverflow2(obj, maxIndex) {
      overflowChannel.set(obj, maxIndex);
      return obj;
    }, "markOverflow");
    var isOverflow = /* @__PURE__ */ __name(function isOverflow2(obj) {
      return overflowChannel.has(obj);
    }, "isOverflow");
    var getMaxIndex = /* @__PURE__ */ __name(function getMaxIndex2(obj) {
      return overflowChannel.get(obj);
    }, "getMaxIndex");
    var setMaxIndex = /* @__PURE__ */ __name(function setMaxIndex2(obj, maxIndex) {
      overflowChannel.set(obj, maxIndex);
    }, "setMaxIndex");
    var hexTable = (function() {
      var array = [];
      for (var i = 0; i < 256; ++i) {
        array[array.length] = "%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase();
      }
      return array;
    })();
    var compactQueue = /* @__PURE__ */ __name(function compactQueue2(queue) {
      while (queue.length > 1) {
        var item = queue.pop();
        var obj = item.obj[item.prop];
        if (isArray(obj)) {
          var compacted = [];
          for (var j = 0; j < obj.length; ++j) {
            if (typeof obj[j] !== "undefined") {
              compacted[compacted.length] = obj[j];
            }
          }
          item.obj[item.prop] = compacted;
        }
      }
    }, "compactQueue");
    var arrayToObject = /* @__PURE__ */ __name(function arrayToObject2(source, options) {
      var obj = options && options.plainObjects ? { __proto__: null } : {};
      for (var i = 0; i < source.length; ++i) {
        if (typeof source[i] !== "undefined") {
          obj[i] = source[i];
        }
      }
      return obj;
    }, "arrayToObject");
    var merge = /* @__PURE__ */ __name(function merge2(target, source, options) {
      if (!source) {
        return target;
      }
      if (typeof source !== "object" && typeof source !== "function") {
        if (isArray(target)) {
          var nextIndex = target.length;
          if (options && typeof options.arrayLimit === "number" && nextIndex > options.arrayLimit) {
            return markOverflow(arrayToObject(target.concat(source), options), nextIndex);
          }
          target[nextIndex] = source;
        } else if (target && typeof target === "object") {
          if (isOverflow(target)) {
            var newIndex = getMaxIndex(target) + 1;
            target[newIndex] = source;
            setMaxIndex(target, newIndex);
          } else if (options && options.strictMerge) {
            return [target, source];
          } else if (options && (options.plainObjects || options.allowPrototypes) || !has.call(Object.prototype, source)) {
            target[source] = true;
          }
        } else {
          return [target, source];
        }
        return target;
      }
      if (!target || typeof target !== "object") {
        if (isOverflow(source)) {
          var sourceKeys = Object.keys(source);
          var result = options && options.plainObjects ? { __proto__: null, 0: target } : { 0: target };
          for (var m = 0; m < sourceKeys.length; m++) {
            var oldKey = parseInt(sourceKeys[m], 10);
            result[oldKey + 1] = source[sourceKeys[m]];
          }
          return markOverflow(result, getMaxIndex(source) + 1);
        }
        var combined = [target].concat(source);
        if (options && typeof options.arrayLimit === "number" && combined.length > options.arrayLimit) {
          return markOverflow(arrayToObject(combined, options), combined.length - 1);
        }
        return combined;
      }
      var mergeTarget = target;
      if (isArray(target) && !isArray(source)) {
        mergeTarget = arrayToObject(target, options);
      }
      if (isArray(target) && isArray(source)) {
        source.forEach(function(item, i) {
          if (has.call(target, i)) {
            var targetItem = target[i];
            if (targetItem && typeof targetItem === "object" && item && typeof item === "object") {
              target[i] = merge2(targetItem, item, options);
            } else {
              target[target.length] = item;
            }
          } else {
            target[i] = item;
          }
        });
        return target;
      }
      return Object.keys(source).reduce(function(acc, key) {
        var value = source[key];
        if (has.call(acc, key)) {
          acc[key] = merge2(acc[key], value, options);
        } else {
          acc[key] = value;
        }
        if (isOverflow(source) && !isOverflow(acc)) {
          markOverflow(acc, getMaxIndex(source));
        }
        if (isOverflow(acc)) {
          var keyNum = parseInt(key, 10);
          if (String(keyNum) === key && keyNum >= 0 && keyNum > getMaxIndex(acc)) {
            setMaxIndex(acc, keyNum);
          }
        }
        return acc;
      }, mergeTarget);
    }, "merge");
    var assign = /* @__PURE__ */ __name(function assignSingleSource(target, source) {
      return Object.keys(source).reduce(function(acc, key) {
        acc[key] = source[key];
        return acc;
      }, target);
    }, "assignSingleSource");
    var decode = /* @__PURE__ */ __name(function(str, defaultDecoder, charset) {
      var strWithoutPlus = str.replace(/\+/g, " ");
      if (charset === "iso-8859-1") {
        return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
      }
      try {
        return decodeURIComponent(strWithoutPlus);
      } catch (e) {
        return strWithoutPlus;
      }
    }, "decode");
    var limit = 1024;
    var encode = /* @__PURE__ */ __name(function encode2(str, defaultEncoder, charset, kind, format) {
      if (str.length === 0) {
        return str;
      }
      var string = str;
      if (typeof str === "symbol") {
        string = Symbol.prototype.toString.call(str);
      } else if (typeof str !== "string") {
        string = String(str);
      }
      if (charset === "iso-8859-1") {
        return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
          return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
        });
      }
      var out = "";
      for (var j = 0; j < string.length; j += limit) {
        var segment = string.length >= limit ? string.slice(j, j + limit) : string;
        var arr = [];
        for (var i = 0; i < segment.length; ++i) {
          var c = segment.charCodeAt(i);
          if (c === 45 || c === 46 || c === 95 || c === 126 || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || format === formats.RFC1738 && (c === 40 || c === 41)) {
            arr[arr.length] = segment.charAt(i);
            continue;
          }
          if (c < 128) {
            arr[arr.length] = hexTable[c];
            continue;
          }
          if (c < 2048) {
            arr[arr.length] = hexTable[192 | c >> 6] + hexTable[128 | c & 63];
            continue;
          }
          if (c < 55296 || c >= 57344) {
            arr[arr.length] = hexTable[224 | c >> 12] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
            continue;
          }
          i += 1;
          c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
          arr[arr.length] = hexTable[240 | c >> 18] + hexTable[128 | c >> 12 & 63] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
        }
        out += arr.join("");
      }
      return out;
    }, "encode");
    var compact = /* @__PURE__ */ __name(function compact2(value) {
      var queue = [{ obj: { o: value }, prop: "o" }];
      var refs = [];
      for (var i = 0; i < queue.length; ++i) {
        var item = queue[i];
        var obj = item.obj[item.prop];
        var keys = Object.keys(obj);
        for (var j = 0; j < keys.length; ++j) {
          var key = keys[j];
          var val = obj[key];
          if (typeof val === "object" && val !== null && refs.indexOf(val) === -1) {
            queue[queue.length] = { obj, prop: key };
            refs[refs.length] = val;
          }
        }
      }
      compactQueue(queue);
      return value;
    }, "compact");
    var isRegExp = /* @__PURE__ */ __name(function isRegExp2(obj) {
      return Object.prototype.toString.call(obj) === "[object RegExp]";
    }, "isRegExp");
    var isBuffer = /* @__PURE__ */ __name(function isBuffer2(obj) {
      if (!obj || typeof obj !== "object") {
        return false;
      }
      return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
    }, "isBuffer");
    var combine = /* @__PURE__ */ __name(function combine2(a, b, arrayLimit, plainObjects) {
      if (isOverflow(a)) {
        var newIndex = getMaxIndex(a) + 1;
        a[newIndex] = b;
        setMaxIndex(a, newIndex);
        return a;
      }
      var result = [].concat(a, b);
      if (result.length > arrayLimit) {
        return markOverflow(arrayToObject(result, { plainObjects }), result.length - 1);
      }
      return result;
    }, "combine");
    var maybeMap = /* @__PURE__ */ __name(function maybeMap2(val, fn) {
      if (isArray(val)) {
        var mapped = [];
        for (var i = 0; i < val.length; i += 1) {
          mapped[mapped.length] = fn(val[i]);
        }
        return mapped;
      }
      return fn(val);
    }, "maybeMap");
    module.exports = {
      arrayToObject,
      assign,
      combine,
      compact,
      decode,
      encode,
      isBuffer,
      isOverflow,
      isRegExp,
      markOverflow,
      maybeMap,
      merge
    };
  }
});

// node_modules/qs/lib/stringify.js
var require_stringify = __commonJS({
  "node_modules/qs/lib/stringify.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var getSideChannel = require_side_channel();
    var utils = require_utils();
    var formats = require_formats();
    var has = Object.prototype.hasOwnProperty;
    var arrayPrefixGenerators = {
      brackets: /* @__PURE__ */ __name(function brackets(prefix) {
        return prefix + "[]";
      }, "brackets"),
      comma: "comma",
      indices: /* @__PURE__ */ __name(function indices(prefix, key) {
        return prefix + "[" + key + "]";
      }, "indices"),
      repeat: /* @__PURE__ */ __name(function repeat(prefix) {
        return prefix;
      }, "repeat")
    };
    var isArray = Array.isArray;
    var push = Array.prototype.push;
    var pushToArray = /* @__PURE__ */ __name(function(arr, valueOrArray) {
      push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray]);
    }, "pushToArray");
    var toISO = Date.prototype.toISOString;
    var defaultFormat = formats["default"];
    var defaults = {
      addQueryPrefix: false,
      allowDots: false,
      allowEmptyArrays: false,
      arrayFormat: "indices",
      charset: "utf-8",
      charsetSentinel: false,
      commaRoundTrip: false,
      delimiter: "&",
      encode: true,
      encodeDotInKeys: false,
      encoder: utils.encode,
      encodeValuesOnly: false,
      filter: void 0,
      format: defaultFormat,
      formatter: formats.formatters[defaultFormat],
      // deprecated
      indices: false,
      serializeDate: /* @__PURE__ */ __name(function serializeDate(date) {
        return toISO.call(date);
      }, "serializeDate"),
      skipNulls: false,
      strictNullHandling: false
    };
    var isNonNullishPrimitive = /* @__PURE__ */ __name(function isNonNullishPrimitive2(v) {
      return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
    }, "isNonNullishPrimitive");
    var sentinel = {};
    var stringify2 = /* @__PURE__ */ __name(function stringify3(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
      var obj = object;
      var tmpSc = sideChannel;
      var step = 0;
      var findFlag = false;
      while ((tmpSc = tmpSc.get(sentinel)) !== void 0 && !findFlag) {
        var pos = tmpSc.get(object);
        step += 1;
        if (typeof pos !== "undefined") {
          if (pos === step) {
            throw new RangeError("Cyclic object value");
          } else {
            findFlag = true;
          }
        }
        if (typeof tmpSc.get(sentinel) === "undefined") {
          step = 0;
        }
      }
      if (typeof filter === "function") {
        obj = filter(prefix, obj);
      } else if (obj instanceof Date) {
        obj = serializeDate(obj);
      } else if (generateArrayPrefix === "comma" && isArray(obj)) {
        obj = utils.maybeMap(obj, function(value2) {
          if (value2 instanceof Date) {
            return serializeDate(value2);
          }
          return value2;
        });
      }
      if (obj === null) {
        if (strictNullHandling) {
          return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, "key", format) : prefix;
        }
        obj = "";
      }
      if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
        if (encoder) {
          var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format);
          return [formatter(keyValue) + "=" + formatter(encoder(obj, defaults.encoder, charset, "value", format))];
        }
        return [formatter(prefix) + "=" + formatter(String(obj))];
      }
      var values = [];
      if (typeof obj === "undefined") {
        return values;
      }
      var objKeys;
      if (generateArrayPrefix === "comma" && isArray(obj)) {
        if (encodeValuesOnly && encoder) {
          obj = utils.maybeMap(obj, encoder);
        }
        objKeys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
      } else if (isArray(filter)) {
        objKeys = filter;
      } else {
        var keys = Object.keys(obj);
        objKeys = sort ? keys.sort(sort) : keys;
      }
      var encodedPrefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
      var adjustedPrefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encodedPrefix + "[]" : encodedPrefix;
      if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
        return adjustedPrefix + "[]";
      }
      for (var j = 0; j < objKeys.length; ++j) {
        var key = objKeys[j];
        var value = typeof key === "object" && key && typeof key.value !== "undefined" ? key.value : obj[key];
        if (skipNulls && value === null) {
          continue;
        }
        var encodedKey = allowDots && encodeDotInKeys ? String(key).replace(/\./g, "%2E") : String(key);
        var keyPrefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjustedPrefix, encodedKey) : adjustedPrefix : adjustedPrefix + (allowDots ? "." + encodedKey : "[" + encodedKey + "]");
        sideChannel.set(object, step);
        var valueSideChannel = getSideChannel();
        valueSideChannel.set(sentinel, sideChannel);
        pushToArray(values, stringify3(
          value,
          keyPrefix,
          generateArrayPrefix,
          commaRoundTrip,
          allowEmptyArrays,
          strictNullHandling,
          skipNulls,
          encodeDotInKeys,
          generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder,
          filter,
          sort,
          allowDots,
          serializeDate,
          format,
          formatter,
          encodeValuesOnly,
          charset,
          valueSideChannel
        ));
      }
      return values;
    }, "stringify");
    var normalizeStringifyOptions = /* @__PURE__ */ __name(function normalizeStringifyOptions2(opts) {
      if (!opts) {
        return defaults;
      }
      if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
        throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
      }
      if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
        throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
      }
      if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
        throw new TypeError("Encoder has to be a function.");
      }
      var charset = opts.charset || defaults.charset;
      if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
        throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
      }
      var format = formats["default"];
      if (typeof opts.format !== "undefined") {
        if (!has.call(formats.formatters, opts.format)) {
          throw new TypeError("Unknown format option provided.");
        }
        format = opts.format;
      }
      var formatter = formats.formatters[format];
      var filter = defaults.filter;
      if (typeof opts.filter === "function" || isArray(opts.filter)) {
        filter = opts.filter;
      }
      var arrayFormat;
      if (opts.arrayFormat in arrayPrefixGenerators) {
        arrayFormat = opts.arrayFormat;
      } else if ("indices" in opts) {
        arrayFormat = opts.indices ? "indices" : "repeat";
      } else {
        arrayFormat = defaults.arrayFormat;
      }
      if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
        throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
      }
      var allowDots = typeof opts.allowDots === "undefined" ? opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
      return {
        addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
        allowDots,
        allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
        arrayFormat,
        charset,
        charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
        commaRoundTrip: !!opts.commaRoundTrip,
        delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
        encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
        encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
        encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
        encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
        filter,
        format,
        formatter,
        serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
        skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
        sort: typeof opts.sort === "function" ? opts.sort : null,
        strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
      };
    }, "normalizeStringifyOptions");
    module.exports = function(object, opts) {
      var obj = object;
      var options = normalizeStringifyOptions(opts);
      var objKeys;
      var filter;
      if (typeof options.filter === "function") {
        filter = options.filter;
        obj = filter("", obj);
      } else if (isArray(options.filter)) {
        filter = options.filter;
        objKeys = filter;
      }
      var keys = [];
      if (typeof obj !== "object" || obj === null) {
        return "";
      }
      var generateArrayPrefix = arrayPrefixGenerators[options.arrayFormat];
      var commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
      if (!objKeys) {
        objKeys = Object.keys(obj);
      }
      if (options.sort) {
        objKeys.sort(options.sort);
      }
      var sideChannel = getSideChannel();
      for (var i = 0; i < objKeys.length; ++i) {
        var key = objKeys[i];
        var value = obj[key];
        if (options.skipNulls && value === null) {
          continue;
        }
        pushToArray(keys, stringify2(
          value,
          key,
          generateArrayPrefix,
          commaRoundTrip,
          options.allowEmptyArrays,
          options.strictNullHandling,
          options.skipNulls,
          options.encodeDotInKeys,
          options.encode ? options.encoder : null,
          options.filter,
          options.sort,
          options.allowDots,
          options.serializeDate,
          options.format,
          options.formatter,
          options.encodeValuesOnly,
          options.charset,
          sideChannel
        ));
      }
      var joined = keys.join(options.delimiter);
      var prefix = options.addQueryPrefix === true ? "?" : "";
      if (options.charsetSentinel) {
        if (options.charset === "iso-8859-1") {
          prefix += "utf8=%26%2310003%3B&";
        } else {
          prefix += "utf8=%E2%9C%93&";
        }
      }
      return joined.length > 0 ? prefix + joined : "";
    };
  }
});

// node_modules/qs/lib/parse.js
var require_parse = __commonJS({
  "node_modules/qs/lib/parse.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var utils = require_utils();
    var has = Object.prototype.hasOwnProperty;
    var isArray = Array.isArray;
    var defaults = {
      allowDots: false,
      allowEmptyArrays: false,
      allowPrototypes: false,
      allowSparse: false,
      arrayLimit: 20,
      charset: "utf-8",
      charsetSentinel: false,
      comma: false,
      decodeDotInKeys: false,
      decoder: utils.decode,
      delimiter: "&",
      depth: 5,
      duplicates: "combine",
      ignoreQueryPrefix: false,
      interpretNumericEntities: false,
      parameterLimit: 1e3,
      parseArrays: true,
      plainObjects: false,
      strictDepth: false,
      strictMerge: true,
      strictNullHandling: false,
      throwOnLimitExceeded: false
    };
    var interpretNumericEntities = /* @__PURE__ */ __name(function(str) {
      return str.replace(/&#(\d+);/g, function($0, numberStr) {
        return String.fromCharCode(parseInt(numberStr, 10));
      });
    }, "interpretNumericEntities");
    var parseArrayValue = /* @__PURE__ */ __name(function(val, options, currentArrayLength) {
      if (val && typeof val === "string" && options.comma && val.indexOf(",") > -1) {
        return val.split(",");
      }
      if (options.throwOnLimitExceeded && currentArrayLength >= options.arrayLimit) {
        throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
      }
      return val;
    }, "parseArrayValue");
    var isoSentinel = "utf8=%26%2310003%3B";
    var charsetSentinel = "utf8=%E2%9C%93";
    var parseValues = /* @__PURE__ */ __name(function parseQueryStringValues(str, options) {
      var obj = { __proto__: null };
      var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, "") : str;
      cleanStr = cleanStr.replace(/%5B/gi, "[").replace(/%5D/gi, "]");
      var limit = options.parameterLimit === Infinity ? void 0 : options.parameterLimit;
      var parts = cleanStr.split(
        options.delimiter,
        options.throwOnLimitExceeded && typeof limit !== "undefined" ? limit + 1 : limit
      );
      if (options.throwOnLimitExceeded && typeof limit !== "undefined" && parts.length > limit) {
        throw new RangeError("Parameter limit exceeded. Only " + limit + " parameter" + (limit === 1 ? "" : "s") + " allowed.");
      }
      var skipIndex = -1;
      var i;
      var charset = options.charset;
      if (options.charsetSentinel) {
        for (i = 0; i < parts.length; ++i) {
          if (parts[i].indexOf("utf8=") === 0) {
            if (parts[i] === charsetSentinel) {
              charset = "utf-8";
            } else if (parts[i] === isoSentinel) {
              charset = "iso-8859-1";
            }
            skipIndex = i;
            i = parts.length;
          }
        }
      }
      for (i = 0; i < parts.length; ++i) {
        if (i === skipIndex) {
          continue;
        }
        var part = parts[i];
        var bracketEqualsPos = part.indexOf("]=");
        var pos = bracketEqualsPos === -1 ? part.indexOf("=") : bracketEqualsPos + 1;
        var key;
        var val;
        if (pos === -1) {
          key = options.decoder(part, defaults.decoder, charset, "key");
          val = options.strictNullHandling ? null : "";
        } else {
          key = options.decoder(part.slice(0, pos), defaults.decoder, charset, "key");
          if (key !== null) {
            val = utils.maybeMap(
              parseArrayValue(
                part.slice(pos + 1),
                options,
                isArray(obj[key]) ? obj[key].length : 0
              ),
              function(encodedVal) {
                return options.decoder(encodedVal, defaults.decoder, charset, "value");
              }
            );
          }
        }
        if (val && options.interpretNumericEntities && charset === "iso-8859-1") {
          val = interpretNumericEntities(String(val));
        }
        if (part.indexOf("[]=") > -1) {
          val = isArray(val) ? [val] : val;
        }
        if (options.comma && isArray(val) && val.length > options.arrayLimit) {
          if (options.throwOnLimitExceeded) {
            throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
          }
          val = utils.combine([], val, options.arrayLimit, options.plainObjects);
        }
        if (key !== null) {
          var existing = has.call(obj, key);
          if (existing && (options.duplicates === "combine" || part.indexOf("[]=") > -1)) {
            obj[key] = utils.combine(
              obj[key],
              val,
              options.arrayLimit,
              options.plainObjects
            );
          } else if (!existing || options.duplicates === "last") {
            obj[key] = val;
          }
        }
      }
      return obj;
    }, "parseQueryStringValues");
    var parseObject = /* @__PURE__ */ __name(function(chain, val, options, valuesParsed) {
      var currentArrayLength = 0;
      if (chain.length > 0 && chain[chain.length - 1] === "[]") {
        var parentKey = chain.slice(0, -1).join("");
        currentArrayLength = Array.isArray(val) && val[parentKey] ? val[parentKey].length : 0;
      }
      var leaf = valuesParsed ? val : parseArrayValue(val, options, currentArrayLength);
      for (var i = chain.length - 1; i >= 0; --i) {
        var obj;
        var root = chain[i];
        if (root === "[]" && options.parseArrays) {
          if (utils.isOverflow(leaf)) {
            obj = leaf;
          } else {
            obj = options.allowEmptyArrays && (leaf === "" || options.strictNullHandling && leaf === null) ? [] : utils.combine(
              [],
              leaf,
              options.arrayLimit,
              options.plainObjects
            );
          }
        } else {
          obj = options.plainObjects ? { __proto__: null } : {};
          var cleanRoot = root.charAt(0) === "[" && root.charAt(root.length - 1) === "]" ? root.slice(1, -1) : root;
          var decodedRoot = options.decodeDotInKeys ? cleanRoot.replace(/%2E/g, ".") : cleanRoot;
          var index = parseInt(decodedRoot, 10);
          var isValidArrayIndex = !isNaN(index) && root !== decodedRoot && String(index) === decodedRoot && index >= 0 && options.parseArrays;
          if (!options.parseArrays && decodedRoot === "") {
            obj = { 0: leaf };
          } else if (isValidArrayIndex && index < options.arrayLimit) {
            obj = [];
            obj[index] = leaf;
          } else if (isValidArrayIndex && options.throwOnLimitExceeded) {
            throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
          } else if (isValidArrayIndex) {
            obj[index] = leaf;
            utils.markOverflow(obj, index);
          } else if (decodedRoot !== "__proto__") {
            obj[decodedRoot] = leaf;
          }
        }
        leaf = obj;
      }
      return leaf;
    }, "parseObject");
    var splitKeyIntoSegments = /* @__PURE__ */ __name(function splitKeyIntoSegments2(givenKey, options) {
      var key = options.allowDots ? givenKey.replace(/\.([^.[]+)/g, "[$1]") : givenKey;
      if (options.depth <= 0) {
        if (!options.plainObjects && has.call(Object.prototype, key)) {
          if (!options.allowPrototypes) {
            return;
          }
        }
        return [key];
      }
      var brackets = /(\[[^[\]]*])/;
      var child = /(\[[^[\]]*])/g;
      var segment = brackets.exec(key);
      var parent = segment ? key.slice(0, segment.index) : key;
      var keys = [];
      if (parent) {
        if (!options.plainObjects && has.call(Object.prototype, parent)) {
          if (!options.allowPrototypes) {
            return;
          }
        }
        keys[keys.length] = parent;
      }
      var i = 0;
      while ((segment = child.exec(key)) !== null && i < options.depth) {
        i += 1;
        var segmentContent = segment[1].slice(1, -1);
        if (!options.plainObjects && has.call(Object.prototype, segmentContent)) {
          if (!options.allowPrototypes) {
            return;
          }
        }
        keys[keys.length] = segment[1];
      }
      if (segment) {
        if (options.strictDepth === true) {
          throw new RangeError("Input depth exceeded depth option of " + options.depth + " and strictDepth is true");
        }
        keys[keys.length] = "[" + key.slice(segment.index) + "]";
      }
      return keys;
    }, "splitKeyIntoSegments");
    var parseKeys = /* @__PURE__ */ __name(function parseQueryStringKeys(givenKey, val, options, valuesParsed) {
      if (!givenKey) {
        return;
      }
      var keys = splitKeyIntoSegments(givenKey, options);
      if (!keys) {
        return;
      }
      return parseObject(keys, val, options, valuesParsed);
    }, "parseQueryStringKeys");
    var normalizeParseOptions = /* @__PURE__ */ __name(function normalizeParseOptions2(opts) {
      if (!opts) {
        return defaults;
      }
      if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
        throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
      }
      if (typeof opts.decodeDotInKeys !== "undefined" && typeof opts.decodeDotInKeys !== "boolean") {
        throw new TypeError("`decodeDotInKeys` option can only be `true` or `false`, when provided");
      }
      if (opts.decoder !== null && typeof opts.decoder !== "undefined" && typeof opts.decoder !== "function") {
        throw new TypeError("Decoder has to be a function.");
      }
      if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
        throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
      }
      if (typeof opts.throwOnLimitExceeded !== "undefined" && typeof opts.throwOnLimitExceeded !== "boolean") {
        throw new TypeError("`throwOnLimitExceeded` option must be a boolean");
      }
      var charset = typeof opts.charset === "undefined" ? defaults.charset : opts.charset;
      var duplicates = typeof opts.duplicates === "undefined" ? defaults.duplicates : opts.duplicates;
      if (duplicates !== "combine" && duplicates !== "first" && duplicates !== "last") {
        throw new TypeError("The duplicates option must be either combine, first, or last");
      }
      var allowDots = typeof opts.allowDots === "undefined" ? opts.decodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
      return {
        allowDots,
        allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
        allowPrototypes: typeof opts.allowPrototypes === "boolean" ? opts.allowPrototypes : defaults.allowPrototypes,
        allowSparse: typeof opts.allowSparse === "boolean" ? opts.allowSparse : defaults.allowSparse,
        arrayLimit: typeof opts.arrayLimit === "number" ? opts.arrayLimit : defaults.arrayLimit,
        charset,
        charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
        comma: typeof opts.comma === "boolean" ? opts.comma : defaults.comma,
        decodeDotInKeys: typeof opts.decodeDotInKeys === "boolean" ? opts.decodeDotInKeys : defaults.decodeDotInKeys,
        decoder: typeof opts.decoder === "function" ? opts.decoder : defaults.decoder,
        delimiter: typeof opts.delimiter === "string" || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults.delimiter,
        // eslint-disable-next-line no-implicit-coercion, no-extra-parens
        depth: typeof opts.depth === "number" || opts.depth === false ? +opts.depth : defaults.depth,
        duplicates,
        ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
        interpretNumericEntities: typeof opts.interpretNumericEntities === "boolean" ? opts.interpretNumericEntities : defaults.interpretNumericEntities,
        parameterLimit: typeof opts.parameterLimit === "number" ? opts.parameterLimit : defaults.parameterLimit,
        parseArrays: opts.parseArrays !== false,
        plainObjects: typeof opts.plainObjects === "boolean" ? opts.plainObjects : defaults.plainObjects,
        strictDepth: typeof opts.strictDepth === "boolean" ? !!opts.strictDepth : defaults.strictDepth,
        strictMerge: typeof opts.strictMerge === "boolean" ? !!opts.strictMerge : defaults.strictMerge,
        strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling,
        throwOnLimitExceeded: typeof opts.throwOnLimitExceeded === "boolean" ? opts.throwOnLimitExceeded : false
      };
    }, "normalizeParseOptions");
    module.exports = function(str, opts) {
      var options = normalizeParseOptions(opts);
      if (str === "" || str === null || typeof str === "undefined") {
        return options.plainObjects ? { __proto__: null } : {};
      }
      var tempObj = typeof str === "string" ? parseValues(str, options) : str;
      var obj = options.plainObjects ? { __proto__: null } : {};
      var keys = Object.keys(tempObj);
      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var newObj = parseKeys(key, tempObj[key], options, typeof str === "string");
        obj = utils.merge(obj, newObj, options);
      }
      if (options.allowSparse === true) {
        return obj;
      }
      return utils.compact(obj);
    };
  }
});

// node_modules/qs/lib/index.js
var require_lib = __commonJS({
  "node_modules/qs/lib/index.js"(exports, module) {
    "use strict";
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    var stringify2 = require_stringify();
    var parse2 = require_parse();
    var formats = require_formats();
    module.exports = {
      formats,
      parse: parse2,
      stringify: stringify2
    };
  }
});

// src/worker/gamification-endpoints.ts
var gamification_endpoints_exports = {};
__export(gamification_endpoints_exports, {
  awardPoints: () => awardPoints,
  getLeaderboard: () => getLeaderboard,
  getUserBadges: () => getUserBadges,
  getUserPoints: () => getUserPoints,
  initializeDefaultBadges: () => initializeDefaultBadges
});
async function awardPoints(env2, userId, points, reason, relatedClipId, relatedCommentId) {
  await env2.DB.prepare(
    `INSERT INTO user_points (mocha_user_id, points, created_at, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(mocha_user_id) DO NOTHING`
  ).bind(userId, 0).run();
  await env2.DB.prepare(
    `INSERT INTO point_transactions (mocha_user_id, points_amount, reason, related_clip_id, related_comment_id, created_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(userId, points, reason, relatedClipId || null, relatedCommentId || null).run();
  await env2.DB.prepare(
    `UPDATE user_points 
     SET points = points + ?, updated_at = CURRENT_TIMESTAMP
     WHERE mocha_user_id = ?`
  ).bind(points, userId).run();
  const userPoints = await env2.DB.prepare(
    `SELECT points FROM user_points WHERE mocha_user_id = ?`
  ).bind(userId).first();
  if (userPoints) {
    const newLevel = calculateLevel(userPoints.points);
    await env2.DB.prepare(
      `UPDATE user_points SET level = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?`
    ).bind(newLevel, userId).run();
  }
  await checkAndAwardBadges(env2, userId);
}
function calculateLevel(points) {
  return Math.floor(points / 100) + 1;
}
async function checkAndAwardBadges(env2, userId) {
  const userStats = await getUserStats(env2, userId);
  const badges = await env2.DB.prepare(`SELECT * FROM badges`).all();
  for (const badge of badges.results || []) {
    const alreadyHas = await env2.DB.prepare(
      `SELECT id FROM user_badges WHERE mocha_user_id = ? AND badge_id = ?`
    ).bind(userId, badge.id).first();
    if (alreadyHas) continue;
    let shouldAward = false;
    const requiredPoints = typeof badge.points_required === "number" ? badge.points_required : 0;
    switch (badge.badge_type) {
      case "uploads":
        shouldAward = userStats.totalClips >= requiredPoints;
        break;
      case "likes":
        shouldAward = userStats.totalLikes >= requiredPoints;
        break;
      case "points":
        shouldAward = userStats.points >= requiredPoints;
        break;
      case "featured":
        shouldAward = userStats.featuredClips >= requiredPoints;
        break;
    }
    if (shouldAward) {
      await env2.DB.prepare(
        `INSERT INTO user_badges (mocha_user_id, badge_id, earned_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`
      ).bind(userId, badge.id).run();
      await env2.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'achievement', ?, CURRENT_TIMESTAMP)`
      ).bind(userId, `You earned the "${badge.name}" badge! \u{1F3C6}`).run();
    }
  }
}
async function getUserStats(env2, userId) {
  const clips = await env2.DB.prepare(
    `SELECT COUNT(*) as count, SUM(likes_count) as likes FROM clips WHERE mocha_user_id = ?`
  ).bind(userId).first();
  const featured = await env2.DB.prepare(
    `SELECT COUNT(*) as count FROM live_featured_clips lfc
     JOIN clips c ON lfc.clip_id = c.id
     WHERE c.mocha_user_id = ?`
  ).bind(userId).first();
  const points = await env2.DB.prepare(
    `SELECT points FROM user_points WHERE mocha_user_id = ?`
  ).bind(userId).first();
  return {
    totalClips: clips?.count || 0,
    totalLikes: clips?.likes || 0,
    featuredClips: featured?.count || 0,
    points: points?.points || 0
  };
}
async function getUserPoints(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userPoints = await c.env.DB.prepare(
    `SELECT points, level FROM user_points WHERE mocha_user_id = ?`
  ).bind(mochaUser.id).first();
  if (!userPoints) {
    await c.env.DB.prepare(
      `INSERT INTO user_points (mocha_user_id, points, level, created_at, updated_at)
       VALUES (?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(mochaUser.id).run();
    return c.json({ points: 0, level: 1 });
  }
  return c.json(userPoints);
}
async function getUserBadges(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const badges = await c.env.DB.prepare(
    `SELECT 
      badges.*,
      user_badges.earned_at
    FROM user_badges
    JOIN badges ON user_badges.badge_id = badges.id
    WHERE user_badges.mocha_user_id = ?
    ORDER BY user_badges.earned_at DESC`
  ).bind(mochaUser.id).all();
  return c.json({ badges: badges.results || [] });
}
async function getLeaderboard(c) {
  const timeframe = c.req.query("timeframe") || "all_time";
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  let query = `
    SELECT 
      user_points.mocha_user_id,
      user_points.points,
      user_points.level,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT user_badges.badge_id) as badge_count
    FROM user_points
    LEFT JOIN user_profiles ON user_points.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN user_badges ON user_points.mocha_user_id = user_badges.mocha_user_id
  `;
  if (timeframe === "weekly") {
    query = `
      SELECT 
        point_transactions.mocha_user_id,
        SUM(point_transactions.points_amount) as points,
        user_points.level,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT user_badges.badge_id) as badge_count
      FROM point_transactions
      LEFT JOIN user_points ON point_transactions.mocha_user_id = user_points.mocha_user_id
      LEFT JOIN user_profiles ON point_transactions.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN user_badges ON point_transactions.mocha_user_id = user_badges.mocha_user_id
      WHERE point_transactions.created_at >= datetime('now', '-7 days')
    `;
  } else if (timeframe === "monthly") {
    query = `
      SELECT 
        point_transactions.mocha_user_id,
        SUM(point_transactions.points_amount) as points,
        user_points.level,
        user_profiles.display_name,
        user_profiles.profile_image_url,
        COUNT(DISTINCT user_badges.badge_id) as badge_count
      FROM point_transactions
      LEFT JOIN user_points ON point_transactions.mocha_user_id = user_points.mocha_user_id
      LEFT JOIN user_profiles ON point_transactions.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN user_badges ON point_transactions.mocha_user_id = user_badges.mocha_user_id
      WHERE point_transactions.created_at >= datetime('now', '-30 days')
    `;
  }
  query += `
    GROUP BY ${timeframe === "all_time" ? "user_points.mocha_user_id" : "point_transactions.mocha_user_id"}
    ORDER BY points DESC
    LIMIT ?
  `;
  const leaderboard = await c.env.DB.prepare(query).bind(limit).all();
  return c.json({ leaderboard: leaderboard.results || [] });
}
async function initializeDefaultBadges(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const defaultBadges = [
    {
      name: "First Upload",
      description: "Shared your first concert moment",
      badge_type: "uploads",
      points_required: 1
    },
    {
      name: "Rising Star",
      description: "Uploaded 10 concert clips",
      badge_type: "uploads",
      points_required: 10
    },
    {
      name: "Content Creator",
      description: "Uploaded 50 concert clips",
      badge_type: "uploads",
      points_required: 50
    },
    {
      name: "Community Favorite",
      description: "Received 100 likes across all clips",
      badge_type: "likes",
      points_required: 100
    },
    {
      name: "Crowd Pleaser",
      description: "Received 1000 likes across all clips",
      badge_type: "likes",
      points_required: 1e3
    },
    {
      name: "MOMENTUM Legend",
      description: "Reached level 10",
      badge_type: "points",
      points_required: 1e3
    },
    {
      name: "Featured Creator",
      description: "Had a clip featured on MOMENTUM Live",
      badge_type: "featured",
      points_required: 1
    }
  ];
  for (const badge of defaultBadges) {
    await c.env.DB.prepare(
      `INSERT INTO badges (name, description, badge_type, points_required, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(name) DO NOTHING`
    ).bind(badge.name, badge.description, badge.badge_type, badge.points_required).run();
  }
  return c.json({ success: true, message: "Default badges initialized" });
}
var init_gamification_endpoints = __esm({
  "src/worker/gamification-endpoints.ts"() {
    init_modules_watch_stub();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
    init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
    init_performance2();
    __name(awardPoints, "awardPoints");
    __name(calculateLevel, "calculateLevel");
    __name(checkAndAwardBadges, "checkAndAwardBadges");
    __name(getUserStats, "getUserStats");
    __name(getUserPoints, "getUserPoints");
    __name(getUserBadges, "getUserBadges");
    __name(getLeaderboard, "getLeaderboard");
    __name(initializeDefaultBadges, "initializeDefaultBadges");
  }
});

// .wrangler/tmp/bundle-RhNPMN/middleware-loader.entry.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// .wrangler/tmp/bundle-RhNPMN/middleware-insertion-facade.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/worker/index.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/hono.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/hono-base.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/compose.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var compose = /* @__PURE__ */ __name((middleware, onError, onNotFound) => {
  return (context2, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context2.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context2, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context2.error = err;
            res = await onError(err, context2);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context2.finalized === false && onNotFound) {
          res = await onNotFound(context2);
        }
      }
      if (res && (context2.finalized === false || isError)) {
        context2.res = res;
      }
      return context2;
    }
    __name(dispatch, "dispatch");
  };
}, "compose");

// node_modules/hono/dist/context.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/request.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/http-exception.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var HTTPException = class extends Error {
  static {
    __name(this, "HTTPException");
  }
  res;
  status;
  /**
   * Creates an instance of `HTTPException`.
   * @param status - HTTP status code for the exception. Defaults to 500.
   * @param options - Additional options for the exception.
   */
  constructor(status = 500, options) {
    super(options?.message, { cause: options?.cause });
    this.res = options?.res;
    this.status = status;
  }
  /**
   * Returns the response object associated with the exception.
   * If a response object is not provided, a new response is created with the error message and status code.
   * @returns The response object.
   */
  getResponse() {
    if (this.res) {
      const newResponse = new Response(this.res.body, {
        status: this.status,
        headers: this.res.headers
      });
      return newResponse;
    }
    return new Response(this.message, {
      status: this.status
    });
  }
};

// node_modules/hono/dist/request/constants.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var parseBody = /* @__PURE__ */ __name(async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
}, "parseBody");
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
__name(parseFormData, "parseFormData");
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
__name(convertFormDataToBodyData, "convertFormDataToBodyData");
var handleParsingAllValues = /* @__PURE__ */ __name((form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
}, "handleParsingAllValues");
var handleParsingNestedValues = /* @__PURE__ */ __name((form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
}, "handleParsingNestedValues");

// node_modules/hono/dist/utils/url.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var splitPath = /* @__PURE__ */ __name((path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
}, "splitPath");
var splitRoutingPath = /* @__PURE__ */ __name((routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
}, "splitRoutingPath");
var extractGroupsFromPath = /* @__PURE__ */ __name((path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
}, "extractGroupsFromPath");
var replaceGroupMarks = /* @__PURE__ */ __name((paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
}, "replaceGroupMarks");
var patternCache = {};
var getPattern = /* @__PURE__ */ __name((label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
}, "getPattern");
var tryDecode = /* @__PURE__ */ __name((str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
}, "tryDecode");
var tryDecodeURI = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURI), "tryDecodeURI");
var getPath = /* @__PURE__ */ __name((request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
}, "getPath");
var getPathNoStrict = /* @__PURE__ */ __name((request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
}, "getPathNoStrict");
var mergePath = /* @__PURE__ */ __name((base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
}, "mergePath");
var checkOptionalParameter = /* @__PURE__ */ __name((path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
}, "checkOptionalParameter");
var _decodeURI = /* @__PURE__ */ __name((value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
}, "_decodeURI");
var _getQueryParam = /* @__PURE__ */ __name((url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
}, "_getQueryParam");
var getQueryParam = _getQueryParam;
var getQueryParams = /* @__PURE__ */ __name((url, key) => {
  return _getQueryParam(url, key, true);
}, "getQueryParams");
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = /* @__PURE__ */ __name((str) => tryDecode(str, decodeURIComponent_), "tryDecodeURIComponent");
var HonoRequest = class {
  static {
    __name(this, "HonoRequest");
  }
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = /* @__PURE__ */ __name((key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  }, "#cachedBody");
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = /* @__PURE__ */ __name((value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
}, "raw");
var resolveCallback = /* @__PURE__ */ __name(async (str, phase, preserveCallbacks, context2, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context: context2 }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context2, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
}, "resolveCallback");

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = /* @__PURE__ */ __name((contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
}, "setDefaultContentType");
var createResponseInstance = /* @__PURE__ */ __name((body, init) => new Response(body, init), "createResponseInstance");
var Context = class {
  static {
    __name(this, "Context");
  }
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = /* @__PURE__ */ __name((...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  }, "render");
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = /* @__PURE__ */ __name((layout) => this.#layout = layout, "setLayout");
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = /* @__PURE__ */ __name(() => this.#layout, "getLayout");
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = /* @__PURE__ */ __name((renderer) => {
    this.#renderer = renderer;
  }, "setRenderer");
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = /* @__PURE__ */ __name((name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  }, "header");
  status = /* @__PURE__ */ __name((status) => {
    this.#status = status;
  }, "status");
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = /* @__PURE__ */ __name((key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  }, "set");
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = /* @__PURE__ */ __name((key) => {
    return this.#var ? this.#var.get(key) : void 0;
  }, "get");
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = /* @__PURE__ */ __name((...args) => this.#newResponse(...args), "newResponse");
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = /* @__PURE__ */ __name((data, arg, headers) => this.#newResponse(data, arg, headers), "body");
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = /* @__PURE__ */ __name((text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  }, "text");
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = /* @__PURE__ */ __name((object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  }, "json");
  html = /* @__PURE__ */ __name((html, arg, headers) => {
    const res = /* @__PURE__ */ __name((html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers)), "res");
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  }, "html");
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = /* @__PURE__ */ __name((location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  }, "redirect");
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name(() => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  }, "notFound");
};

// node_modules/hono/dist/router.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
  static {
    __name(this, "UnsupportedPathError");
  }
};

// node_modules/hono/dist/utils/constants.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = /* @__PURE__ */ __name((c) => {
  return c.text("404 Not Found", 404);
}, "notFoundHandler");
var errorHandler = /* @__PURE__ */ __name((err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
}, "errorHandler");
var Hono = class _Hono {
  static {
    __name(this, "_Hono");
  }
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = /* @__PURE__ */ __name(async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res, "handler");
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = /* @__PURE__ */ __name((handler) => {
    this.errorHandler = handler;
    return this;
  }, "onError");
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = /* @__PURE__ */ __name((handler) => {
    this.#notFoundHandler = handler;
    return this;
  }, "notFound");
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = /* @__PURE__ */ __name((request) => request, "replaceRequest");
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = /* @__PURE__ */ __name(async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    }, "handler");
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = { basePath: this._basePath, path, method, handler };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env2, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env2, "GET")))();
    }
    const path = this.getPath(request, { env: env2 });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env: env2,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context2 = await composed(c);
        if (!context2.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context2.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = /* @__PURE__ */ __name((request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  }, "fetch");
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = /* @__PURE__ */ __name((input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  }, "request");
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = /* @__PURE__ */ __name(() => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  }, "fire");
};

// node_modules/hono/dist/router/reg-exp-router/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/reg-exp-router/router.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/reg-exp-router/matcher.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = /* @__PURE__ */ __name(((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  }), "match2");
  this.match = match2;
  return match2(method, path);
}
__name(match, "match");

// node_modules/hono/dist/router/reg-exp-router/node.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
__name(compareKey, "compareKey");
var Node = class _Node {
  static {
    __name(this, "_Node");
  }
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context2, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context2.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context2, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var Trie = class {
  static {
    __name(this, "Trie");
  }
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
__name(buildWildcardRegExp, "buildWildcardRegExp");
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
__name(clearWildcardRegExpCache, "clearWildcardRegExpCache");
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
__name(buildMatcherFromPreprocessedRoutes, "buildMatcherFromPreprocessedRoutes");
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
__name(findMiddleware, "findMiddleware");
var RegExpRouter = class {
  static {
    __name(this, "RegExpRouter");
  }
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/reg-exp-router/prepared-router.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/smart-router/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/smart-router/router.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var SmartRouter = class {
  static {
    __name(this, "SmartRouter");
  }
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/trie-router/router.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/router/trie-router/node.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = /* @__PURE__ */ __name((children) => {
  for (const _ in children) {
    return true;
  }
  return false;
}, "hasChildren");
var Node2 = class _Node2 {
  static {
    __name(this, "_Node");
  }
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  static {
    __name(this, "TrieRouter");
  }
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  static {
    __name(this, "Hono");
  }
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/@getmocha/users-service/dist/backend.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/helper/cookie/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/hono/dist/utils/cookie.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
var validCookieValueRegEx = /^[ !#-:<-[\]-~]*$/;
var trimCookieWhitespace = /* @__PURE__ */ __name((value) => {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const charCode = value.charCodeAt(start);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    start++;
  }
  while (end > start) {
    const charCode = value.charCodeAt(end - 1);
    if (charCode !== 32 && charCode !== 9) {
      break;
    }
    end--;
  }
  return start === 0 && end === value.length ? value : value.slice(start, end);
}, "trimCookieWhitespace");
var parse = /* @__PURE__ */ __name((cookie, name) => {
  if (name && cookie.indexOf(name) === -1) {
    return {};
  }
  const pairs = cookie.split(";");
  const parsedCookie = {};
  for (const pairStr of pairs) {
    const valueStartPos = pairStr.indexOf("=");
    if (valueStartPos === -1) {
      continue;
    }
    const cookieName = trimCookieWhitespace(pairStr.substring(0, valueStartPos));
    if (name && name !== cookieName || !validCookieNameRegEx.test(cookieName)) {
      continue;
    }
    let cookieValue = trimCookieWhitespace(pairStr.substring(valueStartPos + 1));
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    if (validCookieValueRegEx.test(cookieValue)) {
      parsedCookie[cookieName] = cookieValue.indexOf("%") !== -1 ? tryDecode(cookieValue, decodeURIComponent_) : cookieValue;
      if (name) {
        break;
      }
    }
  }
  return parsedCookie;
}, "parse");
var _serialize = /* @__PURE__ */ __name((name, value, opt = {}) => {
  if (!validCookieNameRegEx.test(name)) {
    throw new Error("Invalid cookie name");
  }
  let cookie = `${name}=${value}`;
  if (name.startsWith("__Secure-") && !opt.secure) {
    throw new Error("__Secure- Cookie must have Secure attributes");
  }
  if (name.startsWith("__Host-")) {
    if (!opt.secure) {
      throw new Error("__Host- Cookie must have Secure attributes");
    }
    if (opt.path !== "/") {
      throw new Error('__Host- Cookie must have Path attributes with "/"');
    }
    if (opt.domain) {
      throw new Error("__Host- Cookie must not have Domain attributes");
    }
  }
  for (const key of ["domain", "path"]) {
    if (opt[key] && /[;\r\n]/.test(opt[key])) {
      throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
    }
  }
  if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
    if (opt.maxAge > 3456e4) {
      throw new Error(
        "Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration."
      );
    }
    cookie += `; Max-Age=${opt.maxAge | 0}`;
  }
  if (opt.domain && opt.prefix !== "host") {
    cookie += `; Domain=${opt.domain}`;
  }
  if (opt.path) {
    cookie += `; Path=${opt.path}`;
  }
  if (opt.expires) {
    if (opt.expires.getTime() - Date.now() > 3456e7) {
      throw new Error(
        "Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future."
      );
    }
    cookie += `; Expires=${opt.expires.toUTCString()}`;
  }
  if (opt.httpOnly) {
    cookie += "; HttpOnly";
  }
  if (opt.secure) {
    cookie += "; Secure";
  }
  if (opt.sameSite) {
    cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
  }
  if (opt.priority) {
    cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
  }
  if (opt.partitioned) {
    if (!opt.secure) {
      throw new Error("Partitioned Cookie must have Secure attributes");
    }
    cookie += "; Partitioned";
  }
  return cookie;
}, "_serialize");
var serialize = /* @__PURE__ */ __name((name, value, opt) => {
  value = encodeURIComponent(value);
  return _serialize(name, value, opt);
}, "serialize");

// node_modules/hono/dist/helper/cookie/index.js
var getCookie = /* @__PURE__ */ __name((c, key, prefix) => {
  const cookie = c.req.raw.headers.get("Cookie");
  if (typeof key === "string") {
    if (!cookie) {
      return void 0;
    }
    let finalKey = key;
    if (prefix === "secure") {
      finalKey = "__Secure-" + key;
    } else if (prefix === "host") {
      finalKey = "__Host-" + key;
    }
    const obj2 = parse(cookie, finalKey);
    return obj2[finalKey];
  }
  if (!cookie) {
    return {};
  }
  const obj = parse(cookie);
  return obj;
}, "getCookie");
var generateCookie = /* @__PURE__ */ __name((name, value, opt) => {
  let cookie;
  if (opt?.prefix === "secure") {
    cookie = serialize("__Secure-" + name, value, { path: "/", ...opt, secure: true });
  } else if (opt?.prefix === "host") {
    cookie = serialize("__Host-" + name, value, {
      ...opt,
      path: "/",
      secure: true,
      domain: void 0
    });
  } else {
    cookie = serialize(name, value, { path: "/", ...opt });
  }
  return cookie;
}, "generateCookie");
var setCookie = /* @__PURE__ */ __name((c, name, value, opt) => {
  const cookie = generateCookie(name, value, opt);
  c.header("Set-Cookie", cookie, { append: true });
}, "setCookie");

// node_modules/hono/dist/helper/factory/index.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var createMiddleware = /* @__PURE__ */ __name((middleware) => middleware, "createMiddleware");

// node_modules/@getmocha/users-service/dist/backend.js
var DEFAULT_MOCHA_USERS_SERVICE_API_URL = "https://getmocha.com/u";
var MOCHA_SESSION_TOKEN_COOKIE_NAME = "mocha_session_token";
async function exchangeCodeForSessionToken(code, options) {
  const apiUrl = options.apiUrl || DEFAULT_MOCHA_USERS_SERVICE_API_URL;
  const response = await fetch(`${apiUrl}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey
    },
    body: JSON.stringify({ code })
  });
  if (!response.ok) {
    throw new Error(`Failed to exchange code for session token: ${response.statusText}`);
  }
  const { session_token } = await response.json();
  return session_token;
}
__name(exchangeCodeForSessionToken, "exchangeCodeForSessionToken");
async function getCurrentUser(sessionToken, options) {
  const apiUrl = options.apiUrl || DEFAULT_MOCHA_USERS_SERVICE_API_URL;
  try {
    const response = await fetch(`${apiUrl}/users/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "x-api-key": options.apiKey
      }
    });
    if (!response.ok) {
      return null;
    }
    const { data: user } = await response.json();
    return user;
  } catch (error3) {
    console.error("Error validating session:", error3);
    return null;
  }
}
__name(getCurrentUser, "getCurrentUser");
async function deleteSession(sessionToken, options) {
  const apiUrl = options.apiUrl || DEFAULT_MOCHA_USERS_SERVICE_API_URL;
  try {
    await fetch(`${apiUrl}/sessions`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "x-api-key": options.apiKey
      }
    });
  } catch (error3) {
    console.error("Error deleting session:", error3);
  }
}
__name(deleteSession, "deleteSession");
var authMiddleware = createMiddleware(async (c, next) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof sessionToken !== "string") {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const options = {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY
  };
  const user = await getCurrentUser(sessionToken, options);
  if (!user) {
    throw new HTTPException(401, { message: "Invalid session token" });
  }
  c.set("user", user);
  await next();
});

// src/worker/hybrid-auth.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import * as crypto2 from "crypto";
var EMAIL_SESSION_COOKIE_NAME = "momentum_email_session";
var SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60;
function isRfc1918PrivateHost(host) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  return /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host);
}
__name(isRfc1918PrivateHost, "isRfc1918PrivateHost");
function isLocalDevHost(c) {
  const host = (c.req.header("host") || "").toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local")) {
    return true;
  }
  const forwardedProto = (c.req.header("x-forwarded-proto") || "").split(",")[0]?.trim().toLowerCase();
  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(c.req.url).protocol.replace(":", "").toLowerCase();
    } catch {
      proto = "";
    }
  }
  if (proto === "https") {
    return false;
  }
  return isRfc1918PrivateHost(host);
}
__name(isLocalDevHost, "isLocalDevHost");
function sessionCookieOptions(c) {
  const local = isLocalDevHost(c);
  return {
    httpOnly: true,
    path: "/",
    sameSite: local ? "lax" : "none",
    secure: !local,
    maxAge: SESSION_MAX_AGE_SEC
  };
}
__name(sessionCookieOptions, "sessionCookieOptions");
function hashOpaqueToken(raw2) {
  return crypto2.createHash("sha256").update(raw2, "utf8").digest("hex");
}
__name(hashOpaqueToken, "hashOpaqueToken");
function hashSessionToken(raw2) {
  return hashOpaqueToken(raw2);
}
__name(hashSessionToken, "hashSessionToken");
function emailAccountToMochaUser(row) {
  const name = row.display_name?.trim() || row.email.split("@")[0] || "User";
  const sub = `email:${row.id}`;
  return {
    id: row.id,
    email: row.email,
    google_sub: sub,
    google_user_data: {
      email: row.email,
      email_verified: false,
      name,
      sub
    },
    last_signed_in_at: (/* @__PURE__ */ new Date()).toISOString(),
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(emailAccountToMochaUser, "emailAccountToMochaUser");
async function createEmailSession(db, userId) {
  const rawToken = crypto2.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + SESSION_MAX_AGE_SEC);
  await db.prepare(
    `INSERT INTO email_sessions (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
  ).bind(userId, tokenHash, expiresAt.toISOString()).run();
  return { rawToken };
}
__name(createEmailSession, "createEmailSession");
async function validateEmailSession(db, rawToken) {
  const tokenHash = hashSessionToken(rawToken);
  const session = await db.prepare(
    `SELECT email_sessions.user_id, email_sessions.expires_at
       FROM email_sessions
       WHERE token_hash = ?`
  ).bind(tokenHash).first();
  if (!session) {
    return null;
  }
  if (new Date(session.expires_at) <= /* @__PURE__ */ new Date()) {
    await db.prepare("DELETE FROM email_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  const account = await db.prepare(
    "SELECT id, email, display_name FROM email_accounts WHERE id = ?"
  ).bind(session.user_id).first();
  return account;
}
__name(validateEmailSession, "validateEmailSession");
async function revokeEmailSession(db, rawToken) {
  const tokenHash = hashSessionToken(rawToken);
  await db.prepare("DELETE FROM email_sessions WHERE token_hash = ?").bind(tokenHash).run();
}
__name(revokeEmailSession, "revokeEmailSession");
async function revokeAllEmailSessionsForUser(db, userId) {
  await db.prepare("DELETE FROM email_sessions WHERE user_id = ?").bind(userId).run();
}
__name(revokeAllEmailSessionsForUser, "revokeAllEmailSessionsForUser");
function setEmailSessionCookie(c, rawToken) {
  setCookie(c, EMAIL_SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(c));
}
__name(setEmailSessionCookie, "setEmailSessionCookie");
function clearEmailSessionCookie(c) {
  const local = isLocalDevHost(c);
  setCookie(c, EMAIL_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: local ? "lax" : "none",
    secure: !local,
    maxAge: 0
  });
}
__name(clearEmailSessionCookie, "clearEmailSessionCookie");
var authMiddleware2 = createMiddleware(async (c, next) => {
  const mochaToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof mochaToken === "string" && mochaToken.length > 0) {
    const user = await getCurrentUser(mochaToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL || DEFAULT_MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY
    });
    if (user) {
      c.set("user", user);
      await next();
      return;
    }
  }
  const emailToken = getCookie(c, EMAIL_SESSION_COOKIE_NAME);
  if (typeof emailToken === "string" && emailToken.length > 0) {
    const account = await validateEmailSession(c.env.DB, emailToken);
    if (account) {
      c.set("user", emailAccountToMochaUser(account));
      await next();
      return;
    }
  }
  return c.json({ error: "Unauthorized" }, 401);
});

// src/worker/scheduled.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function handleScheduled(env2) {
  console.log("Running scheduled tasks...");
  try {
    await handleLiveSessionAdvancement(env2);
    await performanceOptimizations(env2);
    console.log("All scheduled tasks completed successfully");
  } catch (error3) {
    console.error("Error in scheduled tasks:", error3);
  }
}
__name(handleScheduled, "handleScheduled");
async function handleLiveSessionAdvancement(env2) {
  console.log("Running scheduled clip advancement check...");
  try {
    const sessions = await env2.DB.prepare(
      `SELECT id, status, current_clip_id, current_clip_started_at 
       FROM live_sessions 
       WHERE status = 'live'`
    ).all();
    if (!sessions.results || sessions.results.length === 0) {
      console.log("No live sessions found");
      return;
    }
    for (const session of sessions.results) {
      await advanceClipIfNeeded(env2.DB, session);
    }
  } catch (error3) {
    console.error("Error in scheduled clip advancement:", error3);
  }
}
__name(handleLiveSessionAdvancement, "handleLiveSessionAdvancement");
async function performanceOptimizations(env2) {
  console.log("Running performance optimization tasks...");
  try {
    await updateTrendingScores(env2);
    await cleanupOldViewers(env2);
    await cleanupExpiredBans(env2);
    await updateLiveSessionStatuses(env2);
    const { cleanupRateLimits: cleanupRateLimits2 } = await Promise.resolve().then(() => (init_rate_limiter(), rate_limiter_exports));
    cleanupRateLimits2();
    await cleanupOldShares(env2);
    console.log("Performance optimization tasks completed");
  } catch (error3) {
    console.error("Error in performance optimization tasks:", error3);
  }
}
__name(performanceOptimizations, "performanceOptimizations");
async function updateTrendingScores(env2) {
  console.log("Updating trending scores...");
  const sharesCount = await env2.DB.prepare(
    `SELECT clip_id, COUNT(*) as shares
     FROM clip_shares
     GROUP BY clip_id`
  ).all();
  const sharesMap = /* @__PURE__ */ new Map();
  if (sharesCount.results) {
    for (const row of sharesCount.results) {
      sharesMap.set(row.clip_id, row.shares);
    }
  }
  await env2.DB.prepare(
    `UPDATE clips 
     SET is_trending_score = (
       (likes_count * 1.0) + 
       (comments_count * 3.0) + 
       (views_count * 0.1)
     ) / (1 + (julianday('now') - julianday(created_at)) * 0.5),
     updated_at = CURRENT_TIMESTAMP
     WHERE created_at >= date('now', '-30 days')`
  ).run();
  if (sharesCount.results && sharesCount.results.length > 0) {
    for (const row of sharesCount.results) {
      await env2.DB.prepare(
        `UPDATE clips 
         SET is_trending_score = is_trending_score + (? * 5.0),
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(row.shares, row.clip_id).run();
    }
  }
  await env2.DB.prepare(
    `UPDATE clips 
     SET is_trending_score = 0.0,
     updated_at = CURRENT_TIMESTAMP
     WHERE created_at < date('now', '-30 days') 
     AND is_trending_score > 0`
  ).run();
  await checkTrendingThresholds(env2);
  console.log("Trending scores updated");
}
__name(updateTrendingScores, "updateTrendingScores");
async function checkTrendingThresholds(env2) {
  console.log("Checking trending thresholds...");
  const trendingNow = await env2.DB.prepare(
    `SELECT id, mocha_user_id, artist_name, is_trending_score, created_at
     FROM clips
     WHERE is_trending_score >= 100
     AND (julianday('now') - julianday(created_at)) * 24 <= 2
     AND id NOT IN (
       SELECT related_clip_id FROM notifications 
       WHERE type = 'trending' 
       AND related_clip_id = clips.id
     )`
  ).all();
  for (const clip of trendingNow.results || []) {
    await env2.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
       VALUES (?, 'trending', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      clip.mocha_user_id,
      `Your clip is trending! \u{1F4C8}`,
      clip.id
    ).run();
  }
  const momentumLiveEligible = await env2.DB.prepare(
    `SELECT id, mocha_user_id, artist_name, is_trending_score, created_at
     FROM clips
     WHERE is_trending_score >= 500
     AND (julianday('now') - julianday(created_at)) * 24 <= 24
     AND id NOT IN (
       SELECT related_clip_id FROM notifications 
       WHERE type = 'momentum_live_eligible' 
       AND related_clip_id = clips.id
     )`
  ).all();
  for (const clip of momentumLiveEligible.results || []) {
    await env2.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
       VALUES (?, 'momentum_live_eligible', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      clip.mocha_user_id,
      `Your ${clip.artist_name ? clip.artist_name + " " : ""}clip is fire! \u{1F525} It may be featured on Momentum Live`,
      clip.id
    ).run();
  }
  console.log("Trending thresholds checked");
}
__name(checkTrendingThresholds, "checkTrendingThresholds");
async function cleanupOldViewers(env2) {
  console.log("Cleaning up old viewers...");
  await env2.DB.prepare(
    `DELETE FROM live_session_viewers 
     WHERE last_heartbeat < datetime('now', '-5 minutes')`
  ).run();
  console.log("Old viewers cleaned up");
}
__name(cleanupOldViewers, "cleanupOldViewers");
async function cleanupExpiredBans(env2) {
  console.log("Cleaning up expired bans...");
  await env2.DB.prepare(
    `DELETE FROM live_chat_bans 
     WHERE expires_at IS NOT NULL 
     AND expires_at < datetime('now')`
  ).run();
  console.log("Expired bans cleaned up");
}
__name(cleanupExpiredBans, "cleanupExpiredBans");
async function updateLiveSessionStatuses(env2) {
  console.log("Updating live session statuses...");
  await env2.DB.prepare(
    `UPDATE live_sessions 
     SET status = 'ended', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'live' 
     AND end_time < datetime('now')`
  ).run();
  await env2.DB.prepare(
    `UPDATE live_sessions 
     SET status = 'live', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'scheduled' 
     AND start_time <= datetime('now')
     AND end_time > datetime('now')`
  ).run();
  console.log("Live session statuses updated");
}
__name(updateLiveSessionStatuses, "updateLiveSessionStatuses");
async function advanceClipIfNeeded(db, session) {
  console.log(`Checking session ${session.id}...`);
  if (!session.current_clip_id) {
    await startFirstClip(db, session.id);
    return;
  }
  const currentScheduleItem = await db.prepare(
    `SELECT id, clip_id, duration, played_at 
     FROM live_session_clips 
     WHERE live_session_id = ? AND clip_id = ?`
  ).bind(session.id, session.current_clip_id).first();
  if (!currentScheduleItem) {
    console.log(`Current clip not found in schedule for session ${session.id}`);
    return;
  }
  const clipDuration = currentScheduleItem.duration || 180;
  if (session.current_clip_started_at) {
    const startTime = new Date(session.current_clip_started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1e3);
    console.log(`Session ${session.id}: Clip has been playing for ${elapsed}s (duration: ${clipDuration}s)`);
    if (elapsed >= clipDuration) {
      await advanceToNextClip(db, session.id, currentScheduleItem);
    }
  } else {
    await db.prepare(
      `UPDATE live_sessions 
       SET current_clip_started_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(session.id).run();
    console.log(`Set start time for current clip in session ${session.id}`);
  }
}
__name(advanceClipIfNeeded, "advanceClipIfNeeded");
async function startFirstClip(db, sessionId) {
  console.log(`Starting first clip for session ${sessionId}...`);
  const firstClip = await db.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  ).bind(sessionId).first();
  if (!firstClip) {
    console.log(`No clips in schedule for session ${sessionId}`);
    return;
  }
  await db.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(firstClip.clip_id, sessionId).run();
  console.log(`Started clip ${firstClip.clip_id} for session ${sessionId}`);
}
__name(startFirstClip, "startFirstClip");
async function advanceToNextClip(db, sessionId, currentScheduleItem) {
  console.log(`Advancing to next clip for session ${sessionId}...`);
  await db.prepare(
    `UPDATE live_session_clips 
     SET played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(currentScheduleItem.id).run();
  const nextClip = await db.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  ).bind(sessionId).first();
  if (!nextClip) {
    console.log(`No more clips in schedule for session ${sessionId}, ending session`);
    await db.prepare(
      `UPDATE live_sessions 
       SET status = 'ended', current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(sessionId).run();
    return;
  }
  await db.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(nextClip.clip_id, sessionId).run();
  console.log(`Advanced to clip ${nextClip.clip_id} for session ${sessionId}`);
}
__name(advanceToNextClip, "advanceToNextClip");
async function cleanupOldShares(env2) {
  console.log("Cleaning up old shares...");
  await env2.DB.prepare(
    `DELETE FROM clip_shares 
     WHERE created_at < datetime('now', '-90 days')`
  ).run();
  console.log("Old shares cleaned up");
}
__name(cleanupOldShares, "cleanupOldShares");

// src/worker/moderation-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/worker/clip-delete-utils.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function purgeClipFromDatabase(db, clipId) {
  const id = clipId;
  await db.prepare(
    `UPDATE live_sessions
       SET current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE current_clip_id = ?`
  ).bind(id).run();
  await db.prepare("DELETE FROM notifications WHERE related_clip_id = ?").bind(id).run();
  await db.prepare(
    `DELETE FROM notifications WHERE related_comment_id IN (SELECT id FROM comments WHERE clip_id = ?)`
  ).bind(id).run();
  await db.prepare(
    `DELETE FROM point_transactions
       WHERE related_clip_id = ?
          OR related_comment_id IN (SELECT id FROM comments WHERE clip_id = ?)`
  ).bind(id, id).run();
  await db.prepare("DELETE FROM clip_likes WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM saved_clips WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM clip_ratings WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM clip_flags WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM clip_shares WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM user_favorite_clips_by_artist WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM artist_pinned_clips WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM live_featured_clips WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM live_session_clips WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM comments WHERE clip_id = ?").bind(id).run();
  await db.prepare("DELETE FROM clips WHERE id = ?").bind(id).run();
}
__name(purgeClipFromDatabase, "purgeClipFromDatabase");

// src/worker/moderation-endpoints.ts
async function reportClip(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("clipId");
  const body = await c.req.json();
  const { reason } = body;
  if (!reason || !reason.trim()) {
    return c.json({ error: "Report reason is required" }, 400);
  }
  const clip = await c.env.DB.prepare(
    "SELECT id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  const existingFlag = await c.env.DB.prepare(
    "SELECT id FROM clip_flags WHERE clip_id = ? AND reported_by = ?"
  ).bind(clipId, mochaUser.id).first();
  if (existingFlag) {
    return c.json({ error: "You have already reported this clip" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO clip_flags (clip_id, reported_by, reason, status, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(clipId, mochaUser.id, reason.trim()).run();
  return c.json({ success: true }, 201);
}
__name(reportClip, "reportClip");
async function getFlaggedClips(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const statusFilter = c.req.query("status") || "pending";
  let query = `
    SELECT 
      clip_flags.*,
      clips.artist_name,
      clips.venue_name,
      clips.thumbnail_url,
      clips.video_url,
      clips.mocha_user_id as clip_user_id,
      reporter.display_name as reporter_display_name,
      clip_user.display_name as clip_user_display_name
    FROM clip_flags
    LEFT JOIN clips ON clip_flags.clip_id = clips.id
    LEFT JOIN user_profiles AS reporter ON clip_flags.reported_by = reporter.mocha_user_id
    LEFT JOIN user_profiles AS clip_user ON clips.mocha_user_id = clip_user.mocha_user_id
  `;
  const bindings = [];
  if (statusFilter !== "all") {
    query += ` WHERE clip_flags.status = ?`;
    bindings.push(statusFilter);
  }
  query += ` ORDER BY clip_flags.created_at DESC LIMIT 100`;
  const flags = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ flaggedClips: flags.results || [] });
}
__name(getFlaggedClips, "getFlaggedClips");
async function reviewFlaggedClip(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const flagId = c.req.param("flagId");
  const body = await c.req.json();
  const { action } = body;
  if (!action || action !== "approve" && action !== "remove") {
    return c.json({ error: "Invalid action" }, 400);
  }
  const flag = await c.env.DB.prepare(
    "SELECT clip_id FROM clip_flags WHERE id = ?"
  ).bind(flagId).first();
  if (!flag) {
    return c.json({ error: "Flag not found" }, 404);
  }
  if (action === "approve") {
    await c.env.DB.prepare(
      `UPDATE clip_flags 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(mochaUser.id, flagId).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE clips SET is_hidden = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(flag.clip_id).run();
    await c.env.DB.prepare(
      `UPDATE clip_flags 
       SET status = 'removed', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(mochaUser.id, flagId).run();
  }
  return c.json({ success: true });
}
__name(reviewFlaggedClip, "reviewFlaggedClip");
async function deleteClip(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const clipId = Number.parseInt(c.req.param("clipId"), 10);
  if (Number.isNaN(clipId)) {
    return c.json({ error: "Invalid clip id" }, 400);
  }
  await purgeClipFromDatabase(c.env.DB, clipId);
  return c.json({ success: true });
}
__name(deleteClip, "deleteClip");
async function getFlaggedUsers(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const flaggedUsers = await c.env.DB.prepare(
    `SELECT 
      clips.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT clip_flags.id) as flag_count,
      MAX(clip_flags.reason) as latest_flag_reason,
      COALESCE(
        (SELECT 1 FROM user_bans 
         WHERE user_bans.mocha_user_id = clips.mocha_user_id 
         AND (user_bans.expires_at IS NULL OR user_bans.expires_at > datetime('now'))
         LIMIT 1), 
        0
      ) as is_banned
    FROM clip_flags
    JOIN clips ON clip_flags.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clip_flags.status = 'pending'
    GROUP BY clips.mocha_user_id
    HAVING flag_count >= 1
    ORDER BY flag_count DESC
    LIMIT 100`
  ).all();
  return c.json({ flaggedUsers: flaggedUsers.results || [] });
}
__name(getFlaggedUsers, "getFlaggedUsers");
async function banUser(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const userId = c.req.param("userId");
  const body = await c.req.json();
  const { duration_days, reason } = body;
  let expiresAt = null;
  if (duration_days) {
    const expires = /* @__PURE__ */ new Date();
    expires.setDate(expires.getDate() + duration_days);
    expiresAt = expires.toISOString();
  }
  const existingBan = await c.env.DB.prepare(
    `SELECT id FROM user_bans 
     WHERE mocha_user_id = ? 
     AND (expires_at IS NULL OR expires_at > datetime('now'))`
  ).bind(userId).first();
  if (existingBan) {
    await c.env.DB.prepare(
      `UPDATE user_bans 
       SET expires_at = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(expiresAt, reason || null, existingBan.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO user_bans (mocha_user_id, banned_by, reason, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, mochaUser.id, reason || null, expiresAt).run();
  }
  return c.json({ success: true });
}
__name(banUser, "banUser");
async function unbanUser(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const userId = c.req.param("userId");
  await c.env.DB.prepare(
    "DELETE FROM user_bans WHERE mocha_user_id = ?"
  ).bind(userId).run();
  return c.json({ success: true });
}
__name(unbanUser, "unbanUser");

// src/worker/discovery-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function advancedSearch(c) {
  const query = c.req.query("q") || "";
  const location = c.req.query("location") || "";
  const dateRange = c.req.query("dateRange") || "30d";
  const sortBy = c.req.query("sortBy") || "latest";
  if (!query.trim()) {
    return c.json({ clips: [], artists: [], venues: [], users: [] });
  }
  let daysBack = 30;
  switch (dateRange) {
    case "7d":
      daysBack = 7;
      break;
    case "90d":
      daysBack = 90;
      break;
    case "all":
      daysBack = 36500;
      break;
    // ~100 years
    default:
      daysBack = 30;
  }
  let clipsQuery = `
    SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND (
      clips.artist_name LIKE ? OR
      clips.venue_name LIKE ? OR
      clips.location LIKE ? OR
      clips.content_description LIKE ?
    )
  `;
  const bindings = [daysBack, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`];
  if (location) {
    clipsQuery += ` AND clips.location LIKE ?`;
    bindings.push(`%${location}%`);
  }
  switch (sortBy) {
    case "trending":
      clipsQuery += ` ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC`;
      break;
    case "most_liked":
      clipsQuery += ` ORDER BY clips.likes_count DESC`;
      break;
    case "most_viewed":
      clipsQuery += ` ORDER BY clips.views_count DESC`;
      break;
    default:
      clipsQuery += ` ORDER BY clips.created_at DESC`;
  }
  clipsQuery += ` LIMIT 30`;
  const clips = await c.env.DB.prepare(clipsQuery).bind(...bindings).all();
  const artists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name as name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.artist_name LIKE ?
    AND clips.is_hidden = 0
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT 20`
  ).bind(`%${query}%`).all();
  const venues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name as name,
      venues.location,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.venue_name LIKE ?
    AND clips.is_hidden = 0
    GROUP BY clips.venue_name
    ORDER BY clip_count DESC
    LIMIT 20`
  ).bind(`%${query}%`).all();
  const users = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM user_profiles
    LEFT JOIN clips ON user_profiles.mocha_user_id = clips.mocha_user_id AND clips.is_hidden = 0
    WHERE user_profiles.display_name LIKE ?
    GROUP BY user_profiles.mocha_user_id
    HAVING clip_count > 0
    ORDER BY clip_count DESC
    LIMIT 20`
  ).bind(`%${query}%`).all();
  return c.json({
    clips: clips.results || [],
    artists: artists.results || [],
    venues: venues.results || [],
    users: users.results || []
  });
}
__name(advancedSearch, "advancedSearch");
async function getTrendingContent(c) {
  const trendingClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
    LIMIT 12`
  ).all();
  const trendingArtists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name as name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    GROUP BY clips.artist_name
    ORDER BY clip_count DESC
    LIMIT 12`
  ).all();
  const trendingVenues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name as name,
      venues.location,
      COUNT(DISTINCT clips.id) as clip_count
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.is_hidden = 0
    AND clips.created_at >= date('now', '-7 days')
    GROUP BY clips.venue_name
    ORDER BY clip_count DESC
    LIMIT 9`
  ).all();
  return c.json({
    clips: trendingClips.results || [],
    artists: trendingArtists.results || [],
    venues: trendingVenues.results || []
  });
}
__name(getTrendingContent, "getTrendingContent");

// src/worker/jambase-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var JAMBASE_API_BASE = "https://www.jambase.com/jb-api/v1";
async function fetchJamBase(endpoint, apiKey, params = {}) {
  const url = new URL(`${JAMBASE_API_BASE}${endpoint}`);
  url.searchParams.append("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.append(key, value);
  });
  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`JamBase API error: ${response.status}`);
  }
  return response.json();
}
__name(fetchJamBase, "fetchJamBase");
async function searchArtists(c) {
  const query = c.req.query("q") || "";
  const limit = c.req.query("limit") || "20";
  if (!query || query.length < 2) {
    return c.json({ artists: [] });
  }
  try {
    const data = await fetchJamBase("/artists", c.env.JAMBASE_API_KEY, {
      name: query,
      page: "0",
      limit
    });
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      artists: data.artists || [],
      pagination: data.pagination || {}
    });
  } catch (error3) {
    console.error("JamBase artist search error:", error3);
    return c.json({ error: "Failed to search artists", artists: [] }, 500);
  }
}
__name(searchArtists, "searchArtists");
async function searchVenues(c) {
  const query = c.req.query("q") || "";
  const location = c.req.query("location") || "";
  const limit = c.req.query("limit") || "20";
  if (!query && !location) {
    return c.json({ venues: [] });
  }
  try {
    const params = {
      page: "0",
      limit
    };
    if (query) params.name = query;
    if (location) params.geoLocation = location;
    const data = await fetchJamBase("/venues", c.env.JAMBASE_API_KEY, params);
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      venues: data.venues || [],
      pagination: data.pagination || {}
    });
  } catch (error3) {
    console.error("JamBase venue search error:", error3);
    return c.json({ error: "Failed to search venues", venues: [] }, 500);
  }
}
__name(searchVenues, "searchVenues");
async function getArtistTourDates(c) {
  const artistId = c.req.param("artistId");
  const limit = c.req.query("limit") || "50";
  try {
    const data = await fetchJamBase("/events", c.env.JAMBASE_API_KEY, {
      artistId,
      page: "0",
      limit,
      startDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
      // Today onwards
    });
    c.header("Cache-Control", "public, max-age=1800");
    return c.json({
      events: data.events || [],
      pagination: data.pagination || {}
    });
  } catch (error3) {
    console.error("JamBase tour dates error:", error3);
    return c.json({ error: "Failed to fetch tour dates", events: [] }, 500);
  }
}
__name(getArtistTourDates, "getArtistTourDates");
async function matchEventsByLocation(c) {
  const lat = c.req.query("lat");
  const lon = c.req.query("lon");
  const timestamp = c.req.query("timestamp");
  const radius = c.req.query("radius") || "10";
  if (!lat || !lon || !timestamp) {
    return c.json({ error: "lat, lon, and timestamp are required" }, 400);
  }
  try {
    const eventDate = new Date(timestamp);
    const startDate = new Date(eventDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(eventDate);
    endDate.setHours(23, 59, 59, 999);
    const data = await fetchJamBase("/events", c.env.JAMBASE_API_KEY, {
      geoLocation: `${lat},${lon}`,
      radius,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      page: "0",
      limit: "20"
    });
    c.header("Cache-Control", "public, max-age=300");
    return c.json({
      events: data.events || [],
      matchCount: (data.events || []).length
    });
  } catch (error3) {
    console.error("JamBase event matching error:", error3);
    return c.json({ error: "Failed to match events", events: [] }, 500);
  }
}
__name(matchEventsByLocation, "matchEventsByLocation");
async function getUpcomingEvents(c) {
  const location = c.req.query("location") || "";
  const genre = c.req.query("genre") || "";
  const limit = c.req.query("limit") || "30";
  const page = c.req.query("page") || "0";
  try {
    const params = {
      page,
      limit,
      startDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    if (location) params.geoLocation = location;
    if (genre) params.genre = genre;
    const data = await fetchJamBase("/events", c.env.JAMBASE_API_KEY, params);
    c.header("Cache-Control", "public, max-age=600");
    return c.json({
      events: data.events || [],
      pagination: data.pagination || {}
    });
  } catch (error3) {
    console.error("JamBase upcoming events error:", error3);
    return c.json({ error: "Failed to fetch upcoming events", events: [] }, 500);
  }
}
__name(getUpcomingEvents, "getUpcomingEvents");
async function getArtistById(c) {
  const artistId = c.req.param("artistId");
  try {
    const data = await fetchJamBase(`/artists/${artistId}`, c.env.JAMBASE_API_KEY);
    c.header("Cache-Control", "public, max-age=7200");
    return c.json(data);
  } catch (error3) {
    console.error("JamBase artist details error:", error3);
    return c.json({ error: "Failed to fetch artist details" }, 500);
  }
}
__name(getArtistById, "getArtistById");
async function getVenueById(c) {
  const venueId = c.req.param("venueId");
  try {
    const data = await fetchJamBase(`/venues/${venueId}`, c.env.JAMBASE_API_KEY);
    c.header("Cache-Control", "public, max-age=7200");
    return c.json(data);
  } catch (error3) {
    console.error("JamBase venue details error:", error3);
    return c.json({ error: "Failed to fetch venue details" }, 500);
  }
}
__name(getVenueById, "getVenueById");

// src/worker/stripe-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/stripe.esm.worker.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/platform/WebPlatformFunctions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/platform/PlatformFunctions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/net/FetchHttpClient.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/utils.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var qs = __toESM(require_lib(), 1);
var OPTIONS_KEYS = [
  "apiKey",
  "idempotencyKey",
  "stripeAccount",
  "apiVersion",
  "maxNetworkRetries",
  "timeout",
  "host",
  "authenticator",
  "stripeContext",
  "additionalHeaders",
  "streaming"
];
function isOptionsHash(o) {
  return o && typeof o === "object" && OPTIONS_KEYS.some((prop) => Object.prototype.hasOwnProperty.call(o, prop));
}
__name(isOptionsHash, "isOptionsHash");
function queryStringifyRequestData(data, apiMode) {
  return qs.stringify(data, {
    serializeDate: /* @__PURE__ */ __name((d) => Math.floor(d.getTime() / 1e3).toString(), "serializeDate"),
    arrayFormat: apiMode == "v2" ? "repeat" : "indices"
  }).replace(/%5B/g, "[").replace(/%5D/g, "]");
}
__name(queryStringifyRequestData, "queryStringifyRequestData");
var makeURLInterpolator = /* @__PURE__ */ (() => {
  const rc = {
    "\n": "\\n",
    '"': '\\"',
    "\u2028": "\\u2028",
    "\u2029": "\\u2029"
  };
  return (str) => {
    const cleanString = str.replace(/["\n\r\u2028\u2029]/g, ($0) => rc[$0]);
    return (outputs) => {
      return cleanString.replace(/\{([\s\S]+?)\}/g, ($0, $1) => {
        const output = outputs[$1];
        if (isValidEncodeUriComponentType(output))
          return encodeURIComponent(output);
        return "";
      });
    };
  };
})();
function isValidEncodeUriComponentType(value) {
  return ["number", "string", "boolean"].includes(typeof value);
}
__name(isValidEncodeUriComponentType, "isValidEncodeUriComponentType");
function extractUrlParams(path) {
  const params = path.match(/\{\w+\}/g);
  if (!params) {
    return [];
  }
  return params.map((param) => param.replace(/[{}]/g, ""));
}
__name(extractUrlParams, "extractUrlParams");
function getDataFromArgs(args) {
  if (!Array.isArray(args) || !args[0] || typeof args[0] !== "object") {
    return {};
  }
  if (!isOptionsHash(args[0])) {
    return args.shift();
  }
  const argKeys = Object.keys(args[0]);
  const optionKeysInArgs = argKeys.filter((key) => OPTIONS_KEYS.includes(key));
  if (optionKeysInArgs.length > 0 && optionKeysInArgs.length !== argKeys.length) {
    emitWarning2(`Options found in arguments (${optionKeysInArgs.join(", ")}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options.`);
  }
  return {};
}
__name(getDataFromArgs, "getDataFromArgs");
function getOptionsFromArgs(args) {
  const opts = {
    host: null,
    headers: {},
    settings: {},
    streaming: false
  };
  if (args.length > 0) {
    const arg = args[args.length - 1];
    if (typeof arg === "string") {
      opts.authenticator = createApiKeyAuthenticator(args.pop());
    } else if (isOptionsHash(arg)) {
      const params = Object.assign({}, args.pop());
      const extraKeys = Object.keys(params).filter((key) => !OPTIONS_KEYS.includes(key));
      if (extraKeys.length) {
        emitWarning2(`Invalid options found (${extraKeys.join(", ")}); ignoring.`);
      }
      if (params.apiKey) {
        opts.authenticator = createApiKeyAuthenticator(params.apiKey);
      }
      if (params.idempotencyKey) {
        opts.headers["Idempotency-Key"] = params.idempotencyKey;
      }
      if (params.stripeAccount) {
        opts.headers["Stripe-Account"] = params.stripeAccount;
      }
      if (params.stripeContext) {
        if (opts.headers["Stripe-Account"]) {
          throw new Error("Can't specify both stripeAccount and stripeContext.");
        }
        opts.headers["Stripe-Context"] = params.stripeContext;
      }
      if (params.apiVersion) {
        opts.headers["Stripe-Version"] = params.apiVersion;
      }
      if (Number.isInteger(params.maxNetworkRetries)) {
        opts.settings.maxNetworkRetries = params.maxNetworkRetries;
      }
      if (Number.isInteger(params.timeout)) {
        opts.settings.timeout = params.timeout;
      }
      if (params.host) {
        opts.host = params.host;
      }
      if (params.authenticator) {
        if (params.apiKey) {
          throw new Error("Can't specify both apiKey and authenticator.");
        }
        if (typeof params.authenticator !== "function") {
          throw new Error("The authenticator must be a function receiving a request as the first parameter.");
        }
        opts.authenticator = params.authenticator;
      }
      if (params.additionalHeaders) {
        opts.headers = params.additionalHeaders;
      }
      if (params.streaming) {
        opts.streaming = true;
      }
    }
  }
  return opts;
}
__name(getOptionsFromArgs, "getOptionsFromArgs");
function protoExtend(sub) {
  const Super = this;
  const Constructor = Object.prototype.hasOwnProperty.call(sub, "constructor") ? sub.constructor : function(...args) {
    Super.apply(this, args);
  };
  Object.assign(Constructor, Super);
  Constructor.prototype = Object.create(Super.prototype);
  Object.assign(Constructor.prototype, sub);
  return Constructor;
}
__name(protoExtend, "protoExtend");
function removeNullish(obj) {
  if (typeof obj !== "object") {
    throw new Error("Argument must be an object");
  }
  return Object.keys(obj).reduce((result, key) => {
    if (obj[key] != null) {
      result[key] = obj[key];
    }
    return result;
  }, {});
}
__name(removeNullish, "removeNullish");
function normalizeHeaders(obj) {
  if (!(obj && typeof obj === "object")) {
    return obj;
  }
  return Object.keys(obj).reduce((result, header) => {
    result[normalizeHeader(header)] = obj[header];
    return result;
  }, {});
}
__name(normalizeHeaders, "normalizeHeaders");
function normalizeHeader(header) {
  return header.split("-").map((text) => text.charAt(0).toUpperCase() + text.substr(1).toLowerCase()).join("-");
}
__name(normalizeHeader, "normalizeHeader");
function callbackifyPromiseWithTimeout(promise, callback) {
  if (callback) {
    return promise.then((res) => {
      setTimeout(() => {
        callback(null, res);
      }, 0);
    }, (err) => {
      setTimeout(() => {
        callback(err, null);
      }, 0);
    });
  }
  return promise;
}
__name(callbackifyPromiseWithTimeout, "callbackifyPromiseWithTimeout");
function pascalToCamelCase(name) {
  if (name === "OAuth") {
    return "oauth";
  } else {
    return name[0].toLowerCase() + name.substring(1);
  }
}
__name(pascalToCamelCase, "pascalToCamelCase");
function emitWarning2(warning) {
  if (typeof process.emitWarning !== "function") {
    return console.warn(`Stripe: ${warning}`);
  }
  return process.emitWarning(warning, "Stripe");
}
__name(emitWarning2, "emitWarning");
function isObject(obj) {
  const type = typeof obj;
  return (type === "function" || type === "object") && !!obj;
}
__name(isObject, "isObject");
function flattenAndStringify(data) {
  const result = {};
  const step = /* @__PURE__ */ __name((obj, prevKey) => {
    Object.entries(obj).forEach(([key, value]) => {
      const newKey = prevKey ? `${prevKey}[${key}]` : key;
      if (isObject(value)) {
        if (!(value instanceof Uint8Array) && !Object.prototype.hasOwnProperty.call(value, "data")) {
          return step(value, newKey);
        } else {
          result[newKey] = value;
        }
      } else {
        result[newKey] = String(value);
      }
    });
  }, "step");
  step(data, null);
  return result;
}
__name(flattenAndStringify, "flattenAndStringify");
function validateInteger(name, n, defaultVal) {
  if (!Number.isInteger(n)) {
    if (defaultVal !== void 0) {
      return defaultVal;
    } else {
      throw new Error(`${name} must be an integer`);
    }
  }
  return n;
}
__name(validateInteger, "validateInteger");
function determineProcessUserAgentProperties() {
  return typeof process === "undefined" ? {} : {
    lang_version: process.version,
    platform: process.platform
  };
}
__name(determineProcessUserAgentProperties, "determineProcessUserAgentProperties");
function createApiKeyAuthenticator(apiKey) {
  const authenticator = /* @__PURE__ */ __name((request) => {
    request.headers.Authorization = "Bearer " + apiKey;
    return Promise.resolve();
  }, "authenticator");
  authenticator._apiKey = apiKey;
  return authenticator;
}
__name(createApiKeyAuthenticator, "createApiKeyAuthenticator");
function dateTimeReplacer(key, value) {
  if (this[key] instanceof Date) {
    return Math.floor(this[key].getTime() / 1e3).toString();
  }
  return value;
}
__name(dateTimeReplacer, "dateTimeReplacer");
function jsonStringifyRequestData(data) {
  return JSON.stringify(data, dateTimeReplacer);
}
__name(jsonStringifyRequestData, "jsonStringifyRequestData");
function getAPIMode(path) {
  if (!path) {
    return "v1";
  }
  return path.startsWith("/v2") ? "v2" : "v1";
}
__name(getAPIMode, "getAPIMode");
function parseHttpHeaderAsString(header) {
  if (Array.isArray(header)) {
    return header.join(", ");
  }
  return String(header);
}
__name(parseHttpHeaderAsString, "parseHttpHeaderAsString");
function parseHttpHeaderAsNumber(header) {
  const number = Array.isArray(header) ? header[0] : header;
  return Number(number);
}
__name(parseHttpHeaderAsNumber, "parseHttpHeaderAsNumber");
function parseHeadersForFetch(headers) {
  return Object.entries(headers).map(([key, value]) => {
    return [key, parseHttpHeaderAsString(value)];
  });
}
__name(parseHeadersForFetch, "parseHeadersForFetch");

// node_modules/stripe/esm/net/HttpClient.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var HttpClient = class _HttpClient {
  static {
    __name(this, "HttpClient");
  }
  /** The client name used for diagnostics. */
  getClientName() {
    throw new Error("getClientName not implemented.");
  }
  makeRequest(host, port, path, method, headers, requestData, protocol, timeout) {
    throw new Error("makeRequest not implemented.");
  }
  /** Helper to make a consistent timeout error across implementations. */
  static makeTimeoutError() {
    const timeoutErr = new TypeError(_HttpClient.TIMEOUT_ERROR_CODE);
    timeoutErr.code = _HttpClient.TIMEOUT_ERROR_CODE;
    return timeoutErr;
  }
};
HttpClient.CONNECTION_CLOSED_ERROR_CODES = ["ECONNRESET", "EPIPE"];
HttpClient.TIMEOUT_ERROR_CODE = "ETIMEDOUT";
var HttpClientResponse = class {
  static {
    __name(this, "HttpClientResponse");
  }
  constructor(statusCode, headers) {
    this._statusCode = statusCode;
    this._headers = headers;
  }
  getStatusCode() {
    return this._statusCode;
  }
  getHeaders() {
    return this._headers;
  }
  getRawResponse() {
    throw new Error("getRawResponse not implemented.");
  }
  toStream(streamCompleteCallback) {
    throw new Error("toStream not implemented.");
  }
  toJSON() {
    throw new Error("toJSON not implemented.");
  }
};

// node_modules/stripe/esm/net/FetchHttpClient.js
var FetchHttpClient = class _FetchHttpClient extends HttpClient {
  static {
    __name(this, "FetchHttpClient");
  }
  constructor(fetchFn) {
    super();
    if (!fetchFn) {
      if (!globalThis.fetch) {
        throw new Error("fetch() function not provided and is not defined in the global scope. You must provide a fetch implementation.");
      }
      fetchFn = globalThis.fetch;
    }
    if (globalThis.AbortController) {
      this._fetchFn = _FetchHttpClient.makeFetchWithAbortTimeout(fetchFn);
    } else {
      this._fetchFn = _FetchHttpClient.makeFetchWithRaceTimeout(fetchFn);
    }
  }
  static makeFetchWithRaceTimeout(fetchFn) {
    return (url, init, timeout) => {
      let pendingTimeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        pendingTimeoutId = setTimeout(() => {
          pendingTimeoutId = null;
          reject(HttpClient.makeTimeoutError());
        }, timeout);
      });
      const fetchPromise = fetchFn(url, init);
      return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
        if (pendingTimeoutId) {
          clearTimeout(pendingTimeoutId);
        }
      });
    };
  }
  static makeFetchWithAbortTimeout(fetchFn) {
    return async (url, init, timeout) => {
      const abort2 = new AbortController();
      let timeoutId = setTimeout(() => {
        timeoutId = null;
        abort2.abort(HttpClient.makeTimeoutError());
      }, timeout);
      try {
        return await fetchFn(url, Object.assign(Object.assign({}, init), { signal: abort2.signal }));
      } catch (err) {
        if (err.name === "AbortError") {
          throw HttpClient.makeTimeoutError();
        } else {
          throw err;
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
  }
  /** @override. */
  getClientName() {
    return "fetch";
  }
  async makeRequest(host, port, path, method, headers, requestData, protocol, timeout) {
    const isInsecureConnection = protocol === "http";
    const url = new URL(path, `${isInsecureConnection ? "http" : "https"}://${host}`);
    url.port = port;
    const methodHasPayload = method == "POST" || method == "PUT" || method == "PATCH";
    const body = requestData || (methodHasPayload ? "" : void 0);
    const res = await this._fetchFn(url.toString(), {
      method,
      headers: parseHeadersForFetch(headers),
      body
    }, timeout);
    return new FetchHttpClientResponse(res);
  }
};
var FetchHttpClientResponse = class _FetchHttpClientResponse extends HttpClientResponse {
  static {
    __name(this, "FetchHttpClientResponse");
  }
  constructor(res) {
    super(res.status, _FetchHttpClientResponse._transformHeadersToObject(res.headers));
    this._res = res;
  }
  getRawResponse() {
    return this._res;
  }
  toStream(streamCompleteCallback) {
    streamCompleteCallback();
    return this._res.body;
  }
  toJSON() {
    return this._res.json();
  }
  static _transformHeadersToObject(headers) {
    const headersObj = {};
    for (const entry of headers) {
      if (!Array.isArray(entry) || entry.length != 2) {
        throw new Error("Response objects produced by the fetch function given to FetchHttpClient do not have an iterable headers map. Response#headers should be an iterable object.");
      }
      headersObj[entry[0]] = entry[1];
    }
    return headersObj;
  }
};

// node_modules/stripe/esm/crypto/SubtleCryptoProvider.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/crypto/CryptoProvider.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var CryptoProvider = class {
  static {
    __name(this, "CryptoProvider");
  }
  /**
   * Computes a SHA-256 HMAC given a secret and a payload (encoded in UTF-8).
   * The output HMAC should be encoded in hexadecimal.
   *
   * Sample values for implementations:
   * - computeHMACSignature('', 'test_secret') => 'f7f9bd47fb987337b5796fdc1fdb9ba221d0d5396814bfcaf9521f43fd8927fd'
   * - computeHMACSignature('\ud83d\ude00', 'test_secret') => '837da296d05c4fe31f61d5d7ead035099d9585a5bcde87de952012a78f0b0c43
   */
  computeHMACSignature(payload, secret) {
    throw new Error("computeHMACSignature not implemented.");
  }
  /**
   * Asynchronous version of `computeHMACSignature`. Some implementations may
   * only allow support async signature computation.
   *
   * Computes a SHA-256 HMAC given a secret and a payload (encoded in UTF-8).
   * The output HMAC should be encoded in hexadecimal.
   *
   * Sample values for implementations:
   * - computeHMACSignature('', 'test_secret') => 'f7f9bd47fb987337b5796fdc1fdb9ba221d0d5396814bfcaf9521f43fd8927fd'
   * - computeHMACSignature('\ud83d\ude00', 'test_secret') => '837da296d05c4fe31f61d5d7ead035099d9585a5bcde87de952012a78f0b0c43
   */
  computeHMACSignatureAsync(payload, secret) {
    throw new Error("computeHMACSignatureAsync not implemented.");
  }
  /**
   * Computes a SHA-256 hash of the data.
   */
  computeSHA256Async(data) {
    throw new Error("computeSHA256 not implemented.");
  }
};
var CryptoProviderOnlySupportsAsyncError = class extends Error {
  static {
    __name(this, "CryptoProviderOnlySupportsAsyncError");
  }
};

// node_modules/stripe/esm/crypto/SubtleCryptoProvider.js
var SubtleCryptoProvider = class extends CryptoProvider {
  static {
    __name(this, "SubtleCryptoProvider");
  }
  constructor(subtleCrypto) {
    super();
    this.subtleCrypto = subtleCrypto || crypto.subtle;
  }
  /** @override */
  computeHMACSignature(payload, secret) {
    throw new CryptoProviderOnlySupportsAsyncError("SubtleCryptoProvider cannot be used in a synchronous context.");
  }
  /** @override */
  async computeHMACSignatureAsync(payload, secret) {
    const encoder = new TextEncoder();
    const key = await this.subtleCrypto.importKey("raw", encoder.encode(secret), {
      name: "HMAC",
      hash: { name: "SHA-256" }
    }, false, ["sign"]);
    const signatureBuffer = await this.subtleCrypto.sign("hmac", key, encoder.encode(payload));
    const signatureBytes = new Uint8Array(signatureBuffer);
    const signatureHexCodes = new Array(signatureBytes.length);
    for (let i = 0; i < signatureBytes.length; i++) {
      signatureHexCodes[i] = byteHexMapping[signatureBytes[i]];
    }
    return signatureHexCodes.join("");
  }
  /** @override */
  async computeSHA256Async(data) {
    return new Uint8Array(await this.subtleCrypto.digest("SHA-256", data));
  }
};
var byteHexMapping = new Array(256);
for (let i = 0; i < byteHexMapping.length; i++) {
  byteHexMapping[i] = i.toString(16).padStart(2, "0");
}

// node_modules/stripe/esm/platform/PlatformFunctions.js
var PlatformFunctions = class {
  static {
    __name(this, "PlatformFunctions");
  }
  constructor() {
    this._fetchFn = null;
    this._agent = null;
  }
  /**
   * Gets uname with Node's built-in `exec` function, if available.
   */
  getUname() {
    throw new Error("getUname not implemented.");
  }
  /**
   * Generates a v4 UUID. See https://stackoverflow.com/a/2117523
   */
  uuid4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }
  /**
   * Compares strings in constant time.
   */
  secureCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    const len = a.length;
    let result = 0;
    for (let i = 0; i < len; ++i) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
  /**
   * Creates an event emitter.
   */
  createEmitter() {
    throw new Error("createEmitter not implemented.");
  }
  /**
   * Checks if the request data is a stream. If so, read the entire stream
   * to a buffer and return the buffer.
   */
  tryBufferData(data) {
    throw new Error("tryBufferData not implemented.");
  }
  /**
   * Creates an HTTP client which uses the Node `http` and `https` packages
   * to issue requests.
   */
  createNodeHttpClient(agent) {
    throw new Error("createNodeHttpClient not implemented.");
  }
  /**
   * Creates an HTTP client for issuing Stripe API requests which uses the Web
   * Fetch API.
   *
   * A fetch function can optionally be passed in as a parameter. If none is
   * passed, will default to the default `fetch` function in the global scope.
   */
  createFetchHttpClient(fetchFn) {
    return new FetchHttpClient(fetchFn);
  }
  /**
   * Creates an HTTP client using runtime-specific APIs.
   */
  createDefaultHttpClient() {
    throw new Error("createDefaultHttpClient not implemented.");
  }
  /**
   * Creates a CryptoProvider which uses the Node `crypto` package for its computations.
   */
  createNodeCryptoProvider() {
    throw new Error("createNodeCryptoProvider not implemented.");
  }
  /**
   * Creates a CryptoProvider which uses the SubtleCrypto interface of the Web Crypto API.
   */
  createSubtleCryptoProvider(subtleCrypto) {
    return new SubtleCryptoProvider(subtleCrypto);
  }
  createDefaultCryptoProvider() {
    throw new Error("createDefaultCryptoProvider not implemented.");
  }
};

// node_modules/stripe/esm/StripeEmitter.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var _StripeEvent = class extends Event {
  static {
    __name(this, "_StripeEvent");
  }
  constructor(eventName, data) {
    super(eventName);
    this.data = data;
  }
};
var StripeEmitter = class {
  static {
    __name(this, "StripeEmitter");
  }
  constructor() {
    this.eventTarget = new EventTarget();
    this.listenerMapping = /* @__PURE__ */ new Map();
  }
  on(eventName, listener) {
    const listenerWrapper = /* @__PURE__ */ __name((event) => {
      listener(event.data);
    }, "listenerWrapper");
    this.listenerMapping.set(listener, listenerWrapper);
    return this.eventTarget.addEventListener(eventName, listenerWrapper);
  }
  removeListener(eventName, listener) {
    const listenerWrapper = this.listenerMapping.get(listener);
    this.listenerMapping.delete(listener);
    return this.eventTarget.removeEventListener(eventName, listenerWrapper);
  }
  once(eventName, listener) {
    const listenerWrapper = /* @__PURE__ */ __name((event) => {
      listener(event.data);
    }, "listenerWrapper");
    this.listenerMapping.set(listener, listenerWrapper);
    return this.eventTarget.addEventListener(eventName, listenerWrapper, {
      once: true
    });
  }
  emit(eventName, data) {
    return this.eventTarget.dispatchEvent(new _StripeEvent(eventName, data));
  }
};

// node_modules/stripe/esm/platform/WebPlatformFunctions.js
var WebPlatformFunctions = class extends PlatformFunctions {
  static {
    __name(this, "WebPlatformFunctions");
  }
  /** @override */
  getUname() {
    return Promise.resolve(null);
  }
  /** @override */
  createEmitter() {
    return new StripeEmitter();
  }
  /** @override */
  tryBufferData(data) {
    if (data.file.data instanceof ReadableStream) {
      throw new Error("Uploading a file as a stream is not supported in non-Node environments. Please open or upvote an issue at github.com/stripe/stripe-node if you use this, detailing your use-case.");
    }
    return Promise.resolve(data);
  }
  /** @override */
  createNodeHttpClient() {
    throw new Error("Stripe: `createNodeHttpClient()` is not available in non-Node environments. Please use `createFetchHttpClient()` instead.");
  }
  /** @override */
  createDefaultHttpClient() {
    return super.createFetchHttpClient();
  }
  /** @override */
  createNodeCryptoProvider() {
    throw new Error("Stripe: `createNodeCryptoProvider()` is not available in non-Node environments. Please use `createSubtleCryptoProvider()` instead.");
  }
  /** @override */
  createDefaultCryptoProvider() {
    return this.createSubtleCryptoProvider();
  }
};

// node_modules/stripe/esm/stripe.core.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/Error.js
var Error_exports = {};
__export(Error_exports, {
  StripeAPIError: () => StripeAPIError,
  StripeAuthenticationError: () => StripeAuthenticationError,
  StripeCardError: () => StripeCardError,
  StripeConnectionError: () => StripeConnectionError,
  StripeError: () => StripeError,
  StripeIdempotencyError: () => StripeIdempotencyError,
  StripeInvalidGrantError: () => StripeInvalidGrantError,
  StripeInvalidRequestError: () => StripeInvalidRequestError,
  StripePermissionError: () => StripePermissionError,
  StripeRateLimitError: () => StripeRateLimitError,
  StripeSignatureVerificationError: () => StripeSignatureVerificationError,
  StripeUnknownError: () => StripeUnknownError,
  TemporarySessionExpiredError: () => TemporarySessionExpiredError,
  generateV1Error: () => generateV1Error,
  generateV2Error: () => generateV2Error
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var generateV1Error = /* @__PURE__ */ __name((rawStripeError) => {
  switch (rawStripeError.type) {
    case "card_error":
      return new StripeCardError(rawStripeError);
    case "invalid_request_error":
      return new StripeInvalidRequestError(rawStripeError);
    case "api_error":
      return new StripeAPIError(rawStripeError);
    case "authentication_error":
      return new StripeAuthenticationError(rawStripeError);
    case "rate_limit_error":
      return new StripeRateLimitError(rawStripeError);
    case "idempotency_error":
      return new StripeIdempotencyError(rawStripeError);
    case "invalid_grant":
      return new StripeInvalidGrantError(rawStripeError);
    default:
      return new StripeUnknownError(rawStripeError);
  }
}, "generateV1Error");
var generateV2Error = /* @__PURE__ */ __name((rawStripeError) => {
  switch (rawStripeError.type) {
    // switchCases: The beginning of the section generated from our OpenAPI spec
    case "temporary_session_expired":
      return new TemporarySessionExpiredError(rawStripeError);
  }
  switch (rawStripeError.code) {
    case "invalid_fields":
      return new StripeInvalidRequestError(rawStripeError);
  }
  return generateV1Error(rawStripeError);
}, "generateV2Error");
var StripeError = class extends Error {
  static {
    __name(this, "StripeError");
  }
  constructor(raw2 = {}, type = null) {
    var _a;
    super(raw2.message);
    this.type = type || this.constructor.name;
    this.raw = raw2;
    this.rawType = raw2.type;
    this.code = raw2.code;
    this.doc_url = raw2.doc_url;
    this.param = raw2.param;
    this.detail = raw2.detail;
    this.headers = raw2.headers;
    this.requestId = raw2.requestId;
    this.statusCode = raw2.statusCode;
    this.message = (_a = raw2.message) !== null && _a !== void 0 ? _a : "";
    this.userMessage = raw2.user_message;
    this.charge = raw2.charge;
    this.decline_code = raw2.decline_code;
    this.payment_intent = raw2.payment_intent;
    this.payment_method = raw2.payment_method;
    this.payment_method_type = raw2.payment_method_type;
    this.setup_intent = raw2.setup_intent;
    this.source = raw2.source;
  }
};
StripeError.generate = generateV1Error;
var StripeCardError = class extends StripeError {
  static {
    __name(this, "StripeCardError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeCardError");
  }
};
var StripeInvalidRequestError = class extends StripeError {
  static {
    __name(this, "StripeInvalidRequestError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeInvalidRequestError");
  }
};
var StripeAPIError = class extends StripeError {
  static {
    __name(this, "StripeAPIError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeAPIError");
  }
};
var StripeAuthenticationError = class extends StripeError {
  static {
    __name(this, "StripeAuthenticationError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeAuthenticationError");
  }
};
var StripePermissionError = class extends StripeError {
  static {
    __name(this, "StripePermissionError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripePermissionError");
  }
};
var StripeRateLimitError = class extends StripeError {
  static {
    __name(this, "StripeRateLimitError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeRateLimitError");
  }
};
var StripeConnectionError = class extends StripeError {
  static {
    __name(this, "StripeConnectionError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeConnectionError");
  }
};
var StripeSignatureVerificationError = class extends StripeError {
  static {
    __name(this, "StripeSignatureVerificationError");
  }
  constructor(header, payload, raw2 = {}) {
    super(raw2, "StripeSignatureVerificationError");
    this.header = header;
    this.payload = payload;
  }
};
var StripeIdempotencyError = class extends StripeError {
  static {
    __name(this, "StripeIdempotencyError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeIdempotencyError");
  }
};
var StripeInvalidGrantError = class extends StripeError {
  static {
    __name(this, "StripeInvalidGrantError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeInvalidGrantError");
  }
};
var StripeUnknownError = class extends StripeError {
  static {
    __name(this, "StripeUnknownError");
  }
  constructor(raw2 = {}) {
    super(raw2, "StripeUnknownError");
  }
};
var TemporarySessionExpiredError = class extends StripeError {
  static {
    __name(this, "TemporarySessionExpiredError");
  }
  constructor(rawStripeError = {}) {
    super(rawStripeError, "TemporarySessionExpiredError");
  }
};

// node_modules/stripe/esm/RequestSender.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var MAX_RETRY_AFTER_WAIT = 60;
var RequestSender = class _RequestSender {
  static {
    __name(this, "RequestSender");
  }
  constructor(stripe, maxBufferedRequestMetric) {
    this._stripe = stripe;
    this._maxBufferedRequestMetric = maxBufferedRequestMetric;
  }
  _normalizeStripeContext(optsContext, clientContext) {
    if (optsContext) {
      return optsContext.toString() || null;
    }
    return (clientContext === null || clientContext === void 0 ? void 0 : clientContext.toString()) || null;
  }
  _addHeadersDirectlyToObject(obj, headers) {
    obj.requestId = headers["request-id"];
    obj.stripeAccount = obj.stripeAccount || headers["stripe-account"];
    obj.apiVersion = obj.apiVersion || headers["stripe-version"];
    obj.idempotencyKey = obj.idempotencyKey || headers["idempotency-key"];
  }
  _makeResponseEvent(requestEvent, statusCode, headers) {
    const requestEndTime = Date.now();
    const requestDurationMs = requestEndTime - requestEvent.request_start_time;
    return removeNullish({
      api_version: headers["stripe-version"],
      account: headers["stripe-account"],
      idempotency_key: headers["idempotency-key"],
      method: requestEvent.method,
      path: requestEvent.path,
      status: statusCode,
      request_id: this._getRequestId(headers),
      elapsed: requestDurationMs,
      request_start_time: requestEvent.request_start_time,
      request_end_time: requestEndTime
    });
  }
  _getRequestId(headers) {
    return headers["request-id"];
  }
  /**
   * Used by methods with spec.streaming === true. For these methods, we do not
   * buffer successful responses into memory or do parse them into stripe
   * objects, we delegate that all of that to the user and pass back the raw
   * http.Response object to the callback.
   *
   * (Unsuccessful responses shouldn't make it here, they should
   * still be buffered/parsed and handled by _jsonResponseHandler -- see
   * makeRequest)
   */
  _streamingResponseHandler(requestEvent, usage, callback) {
    return (res) => {
      const headers = res.getHeaders();
      const streamCompleteCallback = /* @__PURE__ */ __name(() => {
        const responseEvent = this._makeResponseEvent(requestEvent, res.getStatusCode(), headers);
        this._stripe._emitter.emit("response", responseEvent);
        this._recordRequestMetrics(this._getRequestId(headers), responseEvent.elapsed, usage);
      }, "streamCompleteCallback");
      const stream = res.toStream(streamCompleteCallback);
      this._addHeadersDirectlyToObject(stream, headers);
      return callback(null, stream);
    };
  }
  /**
   * Default handler for Stripe responses. Buffers the response into memory,
   * parses the JSON and returns it (i.e. passes it to the callback) if there
   * is no "error" field. Otherwise constructs/passes an appropriate Error.
   */
  _jsonResponseHandler(requestEvent, apiMode, usage, callback) {
    return (res) => {
      const headers = res.getHeaders();
      const requestId = this._getRequestId(headers);
      const statusCode = res.getStatusCode();
      const responseEvent = this._makeResponseEvent(requestEvent, statusCode, headers);
      this._stripe._emitter.emit("response", responseEvent);
      res.toJSON().then((jsonResponse) => {
        if (jsonResponse.error) {
          let err;
          if (typeof jsonResponse.error === "string") {
            jsonResponse.error = {
              type: jsonResponse.error,
              message: jsonResponse.error_description
            };
          }
          jsonResponse.error.headers = headers;
          jsonResponse.error.statusCode = statusCode;
          jsonResponse.error.requestId = requestId;
          if (statusCode === 401) {
            err = new StripeAuthenticationError(jsonResponse.error);
          } else if (statusCode === 403) {
            err = new StripePermissionError(jsonResponse.error);
          } else if (statusCode === 429) {
            err = new StripeRateLimitError(jsonResponse.error);
          } else if (apiMode === "v2") {
            err = generateV2Error(jsonResponse.error);
          } else {
            err = generateV1Error(jsonResponse.error);
          }
          throw err;
        }
        return jsonResponse;
      }, (e) => {
        throw new StripeAPIError({
          message: "Invalid JSON received from the Stripe API",
          exception: e,
          requestId: headers["request-id"]
        });
      }).then((jsonResponse) => {
        this._recordRequestMetrics(requestId, responseEvent.elapsed, usage);
        const rawResponse = res.getRawResponse();
        this._addHeadersDirectlyToObject(rawResponse, headers);
        Object.defineProperty(jsonResponse, "lastResponse", {
          enumerable: false,
          writable: false,
          value: rawResponse
        });
        callback(null, jsonResponse);
      }, (e) => callback(e, null));
    };
  }
  static _generateConnectionErrorMessage(requestRetries) {
    return `An error occurred with our connection to Stripe.${requestRetries > 0 ? ` Request was retried ${requestRetries} times.` : ""}`;
  }
  // For more on when and how to retry API requests, see https://stripe.com/docs/error-handling#safely-retrying-requests-with-idempotency
  static _shouldRetry(res, numRetries, maxRetries, error3) {
    if (error3 && numRetries === 0 && HttpClient.CONNECTION_CLOSED_ERROR_CODES.includes(error3.code)) {
      return true;
    }
    if (numRetries >= maxRetries) {
      return false;
    }
    if (!res) {
      return true;
    }
    if (res.getHeaders()["stripe-should-retry"] === "false") {
      return false;
    }
    if (res.getHeaders()["stripe-should-retry"] === "true") {
      return true;
    }
    if (res.getStatusCode() === 409) {
      return true;
    }
    if (res.getStatusCode() >= 500) {
      return true;
    }
    return false;
  }
  _getSleepTimeInMS(numRetries, retryAfter = null) {
    const initialNetworkRetryDelay = this._stripe.getInitialNetworkRetryDelay();
    const maxNetworkRetryDelay = this._stripe.getMaxNetworkRetryDelay();
    let sleepSeconds = Math.min(initialNetworkRetryDelay * Math.pow(2, numRetries - 1), maxNetworkRetryDelay);
    sleepSeconds *= 0.5 * (1 + Math.random());
    sleepSeconds = Math.max(initialNetworkRetryDelay, sleepSeconds);
    if (Number.isInteger(retryAfter) && retryAfter <= MAX_RETRY_AFTER_WAIT) {
      sleepSeconds = Math.max(sleepSeconds, retryAfter);
    }
    return sleepSeconds * 1e3;
  }
  // Max retries can be set on a per request basis. Favor those over the global setting
  _getMaxNetworkRetries(settings = {}) {
    return settings.maxNetworkRetries !== void 0 && Number.isInteger(settings.maxNetworkRetries) ? settings.maxNetworkRetries : this._stripe.getMaxNetworkRetries();
  }
  _defaultIdempotencyKey(method, settings, apiMode) {
    const maxRetries = this._getMaxNetworkRetries(settings);
    const genKey = /* @__PURE__ */ __name(() => `stripe-node-retry-${this._stripe._platformFunctions.uuid4()}`, "genKey");
    if (apiMode === "v2") {
      if (method === "POST" || method === "DELETE") {
        return genKey();
      }
    } else if (apiMode === "v1") {
      if (method === "POST" && maxRetries > 0) {
        return genKey();
      }
    }
    return null;
  }
  _makeHeaders({ contentType, contentLength, apiVersion, clientUserAgent, method, userSuppliedHeaders, userSuppliedSettings, stripeAccount, stripeContext, apiMode }) {
    const defaultHeaders = {
      Accept: "application/json",
      "Content-Type": contentType,
      "User-Agent": this._getUserAgentString(apiMode),
      "X-Stripe-Client-User-Agent": clientUserAgent,
      "X-Stripe-Client-Telemetry": this._getTelemetryHeader(),
      "Stripe-Version": apiVersion,
      "Stripe-Account": stripeAccount,
      "Stripe-Context": stripeContext,
      "Idempotency-Key": this._defaultIdempotencyKey(method, userSuppliedSettings, apiMode)
    };
    const methodHasPayload = method == "POST" || method == "PUT" || method == "PATCH";
    if (methodHasPayload || contentLength) {
      if (!methodHasPayload) {
        emitWarning2(`${method} method had non-zero contentLength but no payload is expected for this verb`);
      }
      defaultHeaders["Content-Length"] = contentLength;
    }
    return Object.assign(
      removeNullish(defaultHeaders),
      // If the user supplied, say 'idempotency-key', override instead of appending by ensuring caps are the same.
      normalizeHeaders(userSuppliedHeaders)
    );
  }
  _getUserAgentString(apiMode) {
    const packageVersion = this._stripe.getConstant("PACKAGE_VERSION");
    const appInfo = this._stripe._appInfo ? this._stripe.getAppInfoAsString() : "";
    return `Stripe/${apiMode} NodeBindings/${packageVersion} ${appInfo}`.trim();
  }
  _getTelemetryHeader() {
    if (this._stripe.getTelemetryEnabled() && this._stripe._prevRequestMetrics.length > 0) {
      const metrics = this._stripe._prevRequestMetrics.shift();
      return JSON.stringify({
        last_request_metrics: metrics
      });
    }
  }
  _recordRequestMetrics(requestId, requestDurationMs, usage) {
    if (this._stripe.getTelemetryEnabled() && requestId) {
      if (this._stripe._prevRequestMetrics.length > this._maxBufferedRequestMetric) {
        emitWarning2("Request metrics buffer is full, dropping telemetry message.");
      } else {
        const m = {
          request_id: requestId,
          request_duration_ms: requestDurationMs
        };
        if (usage && usage.length > 0) {
          m.usage = usage;
        }
        this._stripe._prevRequestMetrics.push(m);
      }
    }
  }
  _rawRequest(method, path, params, options, usage) {
    const requestPromise = new Promise((resolve, reject) => {
      let opts;
      try {
        const requestMethod = method.toUpperCase();
        if (requestMethod !== "POST" && params && Object.keys(params).length !== 0) {
          throw new Error("rawRequest only supports params on POST requests. Please pass null and add your parameters to path.");
        }
        const args = [].slice.call([params, options]);
        const dataFromArgs = getDataFromArgs(args);
        const data = requestMethod === "POST" ? Object.assign({}, dataFromArgs) : null;
        const calculatedOptions = getOptionsFromArgs(args);
        const headers2 = calculatedOptions.headers;
        const authenticator2 = calculatedOptions.authenticator;
        opts = {
          requestMethod,
          requestPath: path,
          bodyData: data,
          queryData: {},
          authenticator: authenticator2,
          headers: headers2,
          host: calculatedOptions.host,
          streaming: !!calculatedOptions.streaming,
          settings: {},
          // We use this for thin event internals, so we should record the more specific `usage`, when available
          usage: usage || ["raw_request"]
        };
      } catch (err) {
        reject(err);
        return;
      }
      function requestCallback(err, response) {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      }
      __name(requestCallback, "requestCallback");
      const { headers, settings } = opts;
      const authenticator = opts.authenticator;
      this._request(opts.requestMethod, opts.host, path, opts.bodyData, authenticator, { headers, settings, streaming: opts.streaming }, opts.usage, requestCallback);
    });
    return requestPromise;
  }
  _request(method, host, path, data, authenticator, options, usage = [], callback, requestDataProcessor = null) {
    var _a;
    let requestData;
    authenticator = (_a = authenticator !== null && authenticator !== void 0 ? authenticator : this._stripe._authenticator) !== null && _a !== void 0 ? _a : null;
    const apiMode = getAPIMode(path);
    const retryRequest = /* @__PURE__ */ __name((requestFn, apiVersion, headers, requestRetries, retryAfter) => {
      return setTimeout(requestFn, this._getSleepTimeInMS(requestRetries, retryAfter), apiVersion, headers, requestRetries + 1);
    }, "retryRequest");
    const makeRequest = /* @__PURE__ */ __name((apiVersion, headers, numRetries) => {
      const timeout = options.settings && options.settings.timeout && Number.isInteger(options.settings.timeout) && options.settings.timeout >= 0 ? options.settings.timeout : this._stripe.getApiField("timeout");
      const request = {
        host: host || this._stripe.getApiField("host"),
        port: this._stripe.getApiField("port"),
        path,
        method,
        headers: Object.assign({}, headers),
        body: requestData,
        protocol: this._stripe.getApiField("protocol")
      };
      authenticator(request).then(() => {
        const req = this._stripe.getApiField("httpClient").makeRequest(request.host, request.port, request.path, request.method, request.headers, request.body, request.protocol, timeout);
        const requestStartTime = Date.now();
        const requestEvent = removeNullish({
          api_version: apiVersion,
          account: parseHttpHeaderAsString(headers["Stripe-Account"]),
          idempotency_key: parseHttpHeaderAsString(headers["Idempotency-Key"]),
          method,
          path,
          request_start_time: requestStartTime
        });
        const requestRetries = numRetries || 0;
        const maxRetries = this._getMaxNetworkRetries(options.settings || {});
        this._stripe._emitter.emit("request", requestEvent);
        req.then((res) => {
          if (_RequestSender._shouldRetry(res, requestRetries, maxRetries)) {
            return retryRequest(makeRequest, apiVersion, headers, requestRetries, parseHttpHeaderAsNumber(res.getHeaders()["retry-after"]));
          } else if (options.streaming && res.getStatusCode() < 400) {
            return this._streamingResponseHandler(requestEvent, usage, callback)(res);
          } else {
            return this._jsonResponseHandler(requestEvent, apiMode, usage, callback)(res);
          }
        }).catch((error3) => {
          if (_RequestSender._shouldRetry(null, requestRetries, maxRetries, error3)) {
            return retryRequest(makeRequest, apiVersion, headers, requestRetries, null);
          } else {
            const isTimeoutError = error3.code && error3.code === HttpClient.TIMEOUT_ERROR_CODE;
            return callback(new StripeConnectionError({
              message: isTimeoutError ? `Request aborted due to timeout being reached (${timeout}ms)` : _RequestSender._generateConnectionErrorMessage(requestRetries),
              detail: error3
            }));
          }
        });
      }).catch((e) => {
        throw new StripeError({
          message: "Unable to authenticate the request",
          exception: e
        });
      });
    }, "makeRequest");
    const prepareAndMakeRequest = /* @__PURE__ */ __name((error3, data2) => {
      if (error3) {
        return callback(error3);
      }
      requestData = data2;
      this._stripe.getClientUserAgent((clientUserAgent) => {
        var _a2, _b, _c;
        const apiVersion = this._stripe.getApiField("version");
        const headers = this._makeHeaders({
          contentType: apiMode == "v2" ? "application/json" : "application/x-www-form-urlencoded",
          contentLength: new TextEncoder().encode(requestData).length,
          apiVersion,
          clientUserAgent,
          method,
          // other callers expect null, but .headers being optional means it's undefined if not supplied. So we normalize to null.
          userSuppliedHeaders: (_a2 = options.headers) !== null && _a2 !== void 0 ? _a2 : null,
          userSuppliedSettings: (_b = options.settings) !== null && _b !== void 0 ? _b : {},
          stripeAccount: (_c = options.stripeAccount) !== null && _c !== void 0 ? _c : this._stripe.getApiField("stripeAccount"),
          stripeContext: this._normalizeStripeContext(options.stripeContext, this._stripe.getApiField("stripeContext")),
          apiMode
        });
        makeRequest(apiVersion, headers, 0);
      });
    }, "prepareAndMakeRequest");
    if (requestDataProcessor) {
      requestDataProcessor(method, data, options.headers, prepareAndMakeRequest);
    } else {
      let stringifiedData;
      if (apiMode == "v2") {
        stringifiedData = data ? jsonStringifyRequestData(data) : "";
      } else {
        stringifiedData = queryStringifyRequestData(data || {}, apiMode);
      }
      prepareAndMakeRequest(null, stringifiedData);
    }
  }
};

// node_modules/stripe/esm/StripeResource.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/StripeMethod.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/autoPagination.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var V1Iterator = class {
  static {
    __name(this, "V1Iterator");
  }
  constructor(firstPagePromise, requestArgs, spec, stripeResource) {
    this.index = 0;
    this.pagePromise = firstPagePromise;
    this.promiseCache = { currentPromise: null };
    this.requestArgs = requestArgs;
    this.spec = spec;
    this.stripeResource = stripeResource;
  }
  async iterate(pageResult) {
    if (!(pageResult && pageResult.data && typeof pageResult.data.length === "number")) {
      throw Error("Unexpected: Stripe API response does not have a well-formed `data` array.");
    }
    const reverseIteration = isReverseIteration(this.requestArgs);
    if (this.index < pageResult.data.length) {
      const idx = reverseIteration ? pageResult.data.length - 1 - this.index : this.index;
      const value = pageResult.data[idx];
      this.index += 1;
      return { value, done: false };
    } else if (pageResult.has_more) {
      this.index = 0;
      this.pagePromise = this.getNextPage(pageResult);
      const nextPageResult = await this.pagePromise;
      return this.iterate(nextPageResult);
    }
    return { done: true, value: void 0 };
  }
  /** @abstract */
  getNextPage(_pageResult) {
    throw new Error("Unimplemented");
  }
  async _next() {
    return this.iterate(await this.pagePromise);
  }
  next() {
    if (this.promiseCache.currentPromise) {
      return this.promiseCache.currentPromise;
    }
    const nextPromise = (async () => {
      const ret = await this._next();
      this.promiseCache.currentPromise = null;
      return ret;
    })();
    this.promiseCache.currentPromise = nextPromise;
    return nextPromise;
  }
};
var V1ListIterator = class extends V1Iterator {
  static {
    __name(this, "V1ListIterator");
  }
  getNextPage(pageResult) {
    const reverseIteration = isReverseIteration(this.requestArgs);
    const lastId = getLastId(pageResult, reverseIteration);
    return this.stripeResource._makeRequest(this.requestArgs, this.spec, {
      [reverseIteration ? "ending_before" : "starting_after"]: lastId
    });
  }
};
var V1SearchIterator = class extends V1Iterator {
  static {
    __name(this, "V1SearchIterator");
  }
  getNextPage(pageResult) {
    if (!pageResult.next_page) {
      throw Error("Unexpected: Stripe API response does not have a well-formed `next_page` field, but `has_more` was true.");
    }
    return this.stripeResource._makeRequest(this.requestArgs, this.spec, {
      page: pageResult.next_page
    });
  }
};
var V2ListIterator = class {
  static {
    __name(this, "V2ListIterator");
  }
  constructor(firstPagePromise, requestArgs, spec, stripeResource) {
    this.currentPageIterator = (async () => {
      const page = await firstPagePromise;
      return page.data[Symbol.iterator]();
    })();
    this.nextPageUrl = (async () => {
      const page = await firstPagePromise;
      return page.next_page_url || null;
    })();
    this.requestArgs = requestArgs;
    this.spec = spec;
    this.stripeResource = stripeResource;
  }
  async turnPage() {
    const nextPageUrl = await this.nextPageUrl;
    if (!nextPageUrl)
      return null;
    this.spec.fullPath = nextPageUrl;
    const page = await this.stripeResource._makeRequest([], this.spec, {});
    this.nextPageUrl = Promise.resolve(page.next_page_url);
    this.currentPageIterator = Promise.resolve(page.data[Symbol.iterator]());
    return this.currentPageIterator;
  }
  async next() {
    {
      const result2 = (await this.currentPageIterator).next();
      if (!result2.done)
        return { done: false, value: result2.value };
    }
    const nextPageIterator = await this.turnPage();
    if (!nextPageIterator) {
      return { done: true, value: void 0 };
    }
    const result = nextPageIterator.next();
    if (!result.done)
      return { done: false, value: result.value };
    return { done: true, value: void 0 };
  }
};
var makeAutoPaginationMethods = /* @__PURE__ */ __name((stripeResource, requestArgs, spec, firstPagePromise) => {
  const apiMode = getAPIMode(spec.fullPath || spec.path);
  if (apiMode !== "v2" && spec.methodType === "search") {
    return makeAutoPaginationMethodsFromIterator(new V1SearchIterator(firstPagePromise, requestArgs, spec, stripeResource));
  }
  if (apiMode !== "v2" && spec.methodType === "list") {
    return makeAutoPaginationMethodsFromIterator(new V1ListIterator(firstPagePromise, requestArgs, spec, stripeResource));
  }
  if (apiMode === "v2" && spec.methodType === "list") {
    return makeAutoPaginationMethodsFromIterator(new V2ListIterator(firstPagePromise, requestArgs, spec, stripeResource));
  }
  return null;
}, "makeAutoPaginationMethods");
var makeAutoPaginationMethodsFromIterator = /* @__PURE__ */ __name((iterator) => {
  const autoPagingEach = makeAutoPagingEach((...args) => iterator.next(...args));
  const autoPagingToArray = makeAutoPagingToArray(autoPagingEach);
  const autoPaginationMethods = {
    autoPagingEach,
    autoPagingToArray,
    // Async iterator functions:
    next: /* @__PURE__ */ __name(() => iterator.next(), "next"),
    return: /* @__PURE__ */ __name(() => {
      return {};
    }, "return"),
    [getAsyncIteratorSymbol()]: () => {
      return autoPaginationMethods;
    }
  };
  return autoPaginationMethods;
}, "makeAutoPaginationMethodsFromIterator");
function getAsyncIteratorSymbol() {
  if (typeof Symbol !== "undefined" && Symbol.asyncIterator) {
    return Symbol.asyncIterator;
  }
  return "@@asyncIterator";
}
__name(getAsyncIteratorSymbol, "getAsyncIteratorSymbol");
function getDoneCallback(args) {
  if (args.length < 2) {
    return null;
  }
  const onDone = args[1];
  if (typeof onDone !== "function") {
    throw Error(`The second argument to autoPagingEach, if present, must be a callback function; received ${typeof onDone}`);
  }
  return onDone;
}
__name(getDoneCallback, "getDoneCallback");
function getItemCallback(args) {
  if (args.length === 0) {
    return void 0;
  }
  const onItem = args[0];
  if (typeof onItem !== "function") {
    throw Error(`The first argument to autoPagingEach, if present, must be a callback function; received ${typeof onItem}`);
  }
  if (onItem.length === 2) {
    return onItem;
  }
  if (onItem.length > 2) {
    throw Error(`The \`onItem\` callback function passed to autoPagingEach must accept at most two arguments; got ${onItem}`);
  }
  return /* @__PURE__ */ __name(function _onItem(item, next) {
    const shouldContinue = onItem(item);
    next(shouldContinue);
  }, "_onItem");
}
__name(getItemCallback, "getItemCallback");
function getLastId(listResult, reverseIteration) {
  const lastIdx = reverseIteration ? 0 : listResult.data.length - 1;
  const lastItem = listResult.data[lastIdx];
  const lastId = lastItem && lastItem.id;
  if (!lastId) {
    throw Error("Unexpected: No `id` found on the last item while auto-paging a list.");
  }
  return lastId;
}
__name(getLastId, "getLastId");
function makeAutoPagingEach(asyncIteratorNext) {
  return /* @__PURE__ */ __name(function autoPagingEach() {
    const args = [].slice.call(arguments);
    const onItem = getItemCallback(args);
    const onDone = getDoneCallback(args);
    if (args.length > 2) {
      throw Error(`autoPagingEach takes up to two arguments; received ${args}`);
    }
    const autoPagePromise = wrapAsyncIteratorWithCallback(
      asyncIteratorNext,
      // @ts-ignore we might need a null check
      onItem
    );
    return callbackifyPromiseWithTimeout(autoPagePromise, onDone);
  }, "autoPagingEach");
}
__name(makeAutoPagingEach, "makeAutoPagingEach");
function makeAutoPagingToArray(autoPagingEach) {
  return /* @__PURE__ */ __name(function autoPagingToArray(opts, onDone) {
    const limit = opts && opts.limit;
    if (!limit) {
      throw Error("You must pass a `limit` option to autoPagingToArray, e.g., `autoPagingToArray({limit: 1000});`.");
    }
    if (limit > 1e4) {
      throw Error("You cannot specify a limit of more than 10,000 items to fetch in `autoPagingToArray`; use `autoPagingEach` to iterate through longer lists.");
    }
    const promise = new Promise((resolve, reject) => {
      const items = [];
      autoPagingEach((item) => {
        items.push(item);
        if (items.length >= limit) {
          return false;
        }
      }).then(() => {
        resolve(items);
      }).catch(reject);
    });
    return callbackifyPromiseWithTimeout(promise, onDone);
  }, "autoPagingToArray");
}
__name(makeAutoPagingToArray, "makeAutoPagingToArray");
function wrapAsyncIteratorWithCallback(asyncIteratorNext, onItem) {
  return new Promise((resolve, reject) => {
    function handleIteration(iterResult) {
      if (iterResult.done) {
        resolve();
        return;
      }
      const item = iterResult.value;
      return new Promise((next) => {
        onItem(item, next);
      }).then((shouldContinue) => {
        if (shouldContinue === false) {
          return handleIteration({ done: true, value: void 0 });
        } else {
          return asyncIteratorNext().then(handleIteration);
        }
      });
    }
    __name(handleIteration, "handleIteration");
    asyncIteratorNext().then(handleIteration).catch(reject);
  });
}
__name(wrapAsyncIteratorWithCallback, "wrapAsyncIteratorWithCallback");
function isReverseIteration(requestArgs) {
  const args = [].slice.call(requestArgs);
  const dataFromArgs = getDataFromArgs(args);
  return !!dataFromArgs.ending_before;
}
__name(isReverseIteration, "isReverseIteration");

// node_modules/stripe/esm/StripeMethod.js
function stripeMethod(spec) {
  if (spec.path !== void 0 && spec.fullPath !== void 0) {
    throw new Error(`Method spec specified both a 'path' (${spec.path}) and a 'fullPath' (${spec.fullPath}).`);
  }
  return function(...args) {
    const callback = typeof args[args.length - 1] == "function" && args.pop();
    spec.urlParams = extractUrlParams(spec.fullPath || this.createResourcePathWithSymbols(spec.path || ""));
    const requestPromise = callbackifyPromiseWithTimeout(this._makeRequest(args, spec, {}), callback);
    Object.assign(requestPromise, makeAutoPaginationMethods(this, args, spec, requestPromise));
    return requestPromise;
  };
}
__name(stripeMethod, "stripeMethod");

// node_modules/stripe/esm/StripeResource.js
StripeResource.extend = protoExtend;
StripeResource.method = stripeMethod;
StripeResource.MAX_BUFFERED_REQUEST_METRICS = 100;
function StripeResource(stripe, deprecatedUrlData) {
  this._stripe = stripe;
  if (deprecatedUrlData) {
    throw new Error("Support for curried url params was dropped in stripe-node v7.0.0. Instead, pass two ids.");
  }
  this.basePath = makeURLInterpolator(
    // @ts-ignore changing type of basePath
    this.basePath || stripe.getApiField("basePath")
  );
  this.resourcePath = this.path;
  this.path = makeURLInterpolator(this.path);
  this.initialize(...arguments);
}
__name(StripeResource, "StripeResource");
StripeResource.prototype = {
  _stripe: null,
  // @ts-ignore the type of path changes in ctor
  path: "",
  resourcePath: "",
  // Methods that don't use the API's default '/v1' path can override it with this setting.
  basePath: null,
  initialize() {
  },
  // Function to override the default data processor. This allows full control
  // over how a StripeResource's request data will get converted into an HTTP
  // body. This is useful for non-standard HTTP requests. The function should
  // take method name, data, and headers as arguments.
  requestDataProcessor: null,
  // Function to add a validation checks before sending the request, errors should
  // be thrown, and they will be passed to the callback/promise.
  validateRequest: null,
  createFullPath(commandPath, urlData) {
    const urlParts = [this.basePath(urlData), this.path(urlData)];
    if (typeof commandPath === "function") {
      const computedCommandPath = commandPath(urlData);
      if (computedCommandPath) {
        urlParts.push(computedCommandPath);
      }
    } else {
      urlParts.push(commandPath);
    }
    return this._joinUrlParts(urlParts);
  },
  // Creates a relative resource path with symbols left in (unlike
  // createFullPath which takes some data to replace them with). For example it
  // might produce: /invoices/{id}
  createResourcePathWithSymbols(pathWithSymbols) {
    if (pathWithSymbols) {
      return `/${this._joinUrlParts([this.resourcePath, pathWithSymbols])}`;
    } else {
      return `/${this.resourcePath}`;
    }
  },
  _joinUrlParts(parts) {
    return parts.join("/").replace(/\/{2,}/g, "/");
  },
  _getRequestOpts(requestArgs, spec, overrideData) {
    var _a;
    const requestMethod = (spec.method || "GET").toUpperCase();
    const usage = spec.usage || [];
    const urlParams = spec.urlParams || [];
    const encode = spec.encode || ((data2) => data2);
    const isUsingFullPath = !!spec.fullPath;
    const commandPath = makeURLInterpolator(isUsingFullPath ? spec.fullPath : spec.path || "");
    const path = isUsingFullPath ? spec.fullPath : this.createResourcePathWithSymbols(spec.path);
    const args = [].slice.call(requestArgs);
    const urlData = urlParams.reduce((urlData2, param) => {
      const arg = args.shift();
      if (typeof arg !== "string") {
        throw new Error(`Stripe: Argument "${param}" must be a string, but got: ${arg} (on API request to \`${requestMethod} ${path}\`)`);
      }
      urlData2[param] = arg;
      return urlData2;
    }, {});
    const dataFromArgs = getDataFromArgs(args);
    const data = encode(Object.assign({}, dataFromArgs, overrideData));
    const options = getOptionsFromArgs(args);
    const host = options.host || spec.host;
    const streaming = !!spec.streaming || !!options.streaming;
    if (args.filter((x) => x != null).length) {
      throw new Error(`Stripe: Unknown arguments (${args}). Did you mean to pass an options object? See https://github.com/stripe/stripe-node/wiki/Passing-Options. (on API request to ${requestMethod} \`${path}\`)`);
    }
    const requestPath = isUsingFullPath ? commandPath(urlData) : this.createFullPath(commandPath, urlData);
    const headers = Object.assign(options.headers, spec.headers);
    if (spec.validator) {
      spec.validator(data, { headers });
    }
    const dataInQuery = spec.method === "GET" || spec.method === "DELETE";
    const bodyData = dataInQuery ? null : data;
    const queryData = dataInQuery ? data : {};
    return {
      requestMethod,
      requestPath,
      bodyData,
      queryData,
      authenticator: (_a = options.authenticator) !== null && _a !== void 0 ? _a : null,
      headers,
      host: host !== null && host !== void 0 ? host : null,
      streaming,
      settings: options.settings,
      usage
    };
  },
  _makeRequest(requestArgs, spec, overrideData) {
    return new Promise((resolve, reject) => {
      var _a;
      let opts;
      try {
        opts = this._getRequestOpts(requestArgs, spec, overrideData);
      } catch (err) {
        reject(err);
        return;
      }
      function requestCallback(err, response) {
        if (err) {
          reject(err);
        } else {
          resolve(spec.transformResponseData ? spec.transformResponseData(response) : response);
        }
      }
      __name(requestCallback, "requestCallback");
      const emptyQuery = Object.keys(opts.queryData).length === 0;
      const path = [
        opts.requestPath,
        emptyQuery ? "" : "?",
        queryStringifyRequestData(opts.queryData, getAPIMode(opts.requestPath))
      ].join("");
      const { headers, settings } = opts;
      this._stripe._requestSender._request(opts.requestMethod, opts.host, path, opts.bodyData, opts.authenticator, {
        headers,
        settings,
        streaming: opts.streaming
      }, opts.usage, requestCallback, (_a = this.requestDataProcessor) === null || _a === void 0 ? void 0 : _a.bind(this));
    });
  }
};

// node_modules/stripe/esm/StripeContext.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var StripeContext = class _StripeContext {
  static {
    __name(this, "StripeContext");
  }
  /**
   * Creates a new StripeContext with the given segments.
   */
  constructor(segments = []) {
    this._segments = [...segments];
  }
  /**
   * Gets a copy of the segments of this Context.
   */
  get segments() {
    return [...this._segments];
  }
  /**
   * Creates a new StripeContext with an additional segment appended.
   */
  push(segment) {
    if (!segment) {
      throw new Error("Segment cannot be null or undefined");
    }
    return new _StripeContext([...this._segments, segment]);
  }
  /**
   * Creates a new StripeContext with the last segment removed.
   * If there are no segments, throws an error.
   */
  pop() {
    if (this._segments.length === 0) {
      throw new Error("Cannot pop from an empty context");
    }
    return new _StripeContext(this._segments.slice(0, -1));
  }
  /**
   * Converts this context to its string representation.
   */
  toString() {
    return this._segments.join("/");
  }
  /**
   * Parses a context string into a StripeContext instance.
   */
  static parse(contextStr) {
    if (!contextStr) {
      return new _StripeContext([]);
    }
    return new _StripeContext(contextStr.split("/"));
  }
};

// node_modules/stripe/esm/Webhooks.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function createWebhooks(platformFunctions) {
  const Webhook = {
    DEFAULT_TOLERANCE: 300,
    signature: null,
    constructEvent(payload, header, secret, tolerance, cryptoProvider, receivedAt) {
      try {
        if (!this.signature) {
          throw new Error("ERR: missing signature helper, unable to verify");
        }
        this.signature.verifyHeader(payload, header, secret, tolerance || Webhook.DEFAULT_TOLERANCE, cryptoProvider, receivedAt);
      } catch (e) {
        if (e instanceof CryptoProviderOnlySupportsAsyncError) {
          e.message += "\nUse `await constructEventAsync(...)` instead of `constructEvent(...)`";
        }
        throw e;
      }
      const jsonPayload = payload instanceof Uint8Array ? JSON.parse(new TextDecoder("utf8").decode(payload)) : JSON.parse(payload);
      return jsonPayload;
    },
    async constructEventAsync(payload, header, secret, tolerance, cryptoProvider, receivedAt) {
      if (!this.signature) {
        throw new Error("ERR: missing signature helper, unable to verify");
      }
      await this.signature.verifyHeaderAsync(payload, header, secret, tolerance || Webhook.DEFAULT_TOLERANCE, cryptoProvider, receivedAt);
      const jsonPayload = payload instanceof Uint8Array ? JSON.parse(new TextDecoder("utf8").decode(payload)) : JSON.parse(payload);
      return jsonPayload;
    },
    /**
     * Generates a header to be used for webhook mocking
     *
     * @typedef {object} opts
     * @property {number} timestamp - Timestamp of the header. Defaults to Date.now()
     * @property {string} payload - JSON stringified payload object, containing the 'id' and 'object' parameters
     * @property {string} secret - Stripe webhook secret 'whsec_...'
     * @property {string} scheme - Version of API to hit. Defaults to 'v1'.
     * @property {string} signature - Computed webhook signature
     * @property {CryptoProvider} cryptoProvider - Crypto provider to use for computing the signature if none was provided. Defaults to NodeCryptoProvider.
     */
    generateTestHeaderString: /* @__PURE__ */ __name(function(opts) {
      const preparedOpts = prepareOptions(opts);
      const signature2 = preparedOpts.signature || preparedOpts.cryptoProvider.computeHMACSignature(preparedOpts.payloadString, preparedOpts.secret);
      return preparedOpts.generateHeaderString(signature2);
    }, "generateTestHeaderString"),
    generateTestHeaderStringAsync: /* @__PURE__ */ __name(async function(opts) {
      const preparedOpts = prepareOptions(opts);
      const signature2 = preparedOpts.signature || await preparedOpts.cryptoProvider.computeHMACSignatureAsync(preparedOpts.payloadString, preparedOpts.secret);
      return preparedOpts.generateHeaderString(signature2);
    }, "generateTestHeaderStringAsync")
  };
  const signature = {
    EXPECTED_SCHEME: "v1",
    verifyHeader(encodedPayload, encodedHeader, secret, tolerance, cryptoProvider, receivedAt) {
      const { decodedHeader: header, decodedPayload: payload, details, suspectPayloadType } = parseEventDetails(encodedPayload, encodedHeader, this.EXPECTED_SCHEME);
      const secretContainsWhitespace = /\s/.test(secret);
      cryptoProvider = cryptoProvider || getCryptoProvider();
      const expectedSignature = cryptoProvider.computeHMACSignature(makeHMACContent(payload, details), secret);
      validateComputedSignature(payload, header, details, expectedSignature, tolerance, suspectPayloadType, secretContainsWhitespace, receivedAt);
      return true;
    },
    async verifyHeaderAsync(encodedPayload, encodedHeader, secret, tolerance, cryptoProvider, receivedAt) {
      const { decodedHeader: header, decodedPayload: payload, details, suspectPayloadType } = parseEventDetails(encodedPayload, encodedHeader, this.EXPECTED_SCHEME);
      const secretContainsWhitespace = /\s/.test(secret);
      cryptoProvider = cryptoProvider || getCryptoProvider();
      const expectedSignature = await cryptoProvider.computeHMACSignatureAsync(makeHMACContent(payload, details), secret);
      return validateComputedSignature(payload, header, details, expectedSignature, tolerance, suspectPayloadType, secretContainsWhitespace, receivedAt);
    }
  };
  function makeHMACContent(payload, details) {
    return `${details.timestamp}.${payload}`;
  }
  __name(makeHMACContent, "makeHMACContent");
  function parseEventDetails(encodedPayload, encodedHeader, expectedScheme) {
    if (!encodedPayload) {
      throw new StripeSignatureVerificationError(encodedHeader, encodedPayload, {
        message: "No webhook payload was provided."
      });
    }
    const suspectPayloadType = typeof encodedPayload != "string" && !(encodedPayload instanceof Uint8Array);
    const textDecoder = new TextDecoder("utf8");
    const decodedPayload = encodedPayload instanceof Uint8Array ? textDecoder.decode(encodedPayload) : encodedPayload;
    if (Array.isArray(encodedHeader)) {
      throw new Error("Unexpected: An array was passed as a header, which should not be possible for the stripe-signature header.");
    }
    if (encodedHeader == null || encodedHeader == "") {
      throw new StripeSignatureVerificationError(encodedHeader, encodedPayload, {
        message: "No stripe-signature header value was provided."
      });
    }
    const decodedHeader = encodedHeader instanceof Uint8Array ? textDecoder.decode(encodedHeader) : encodedHeader;
    const details = parseHeader(decodedHeader, expectedScheme);
    if (!details || details.timestamp === -1) {
      throw new StripeSignatureVerificationError(decodedHeader, decodedPayload, {
        message: "Unable to extract timestamp and signatures from header"
      });
    }
    if (!details.signatures.length) {
      throw new StripeSignatureVerificationError(decodedHeader, decodedPayload, {
        message: "No signatures found with expected scheme"
      });
    }
    return {
      decodedPayload,
      decodedHeader,
      details,
      suspectPayloadType
    };
  }
  __name(parseEventDetails, "parseEventDetails");
  function validateComputedSignature(payload, header, details, expectedSignature, tolerance, suspectPayloadType, secretContainsWhitespace, receivedAt) {
    const signatureFound = !!details.signatures.filter(platformFunctions.secureCompare.bind(platformFunctions, expectedSignature)).length;
    const docsLocation = "\nLearn more about webhook signing and explore webhook integration examples for various frameworks at https://docs.stripe.com/webhooks/signature";
    const whitespaceMessage = secretContainsWhitespace ? "\n\nNote: The provided signing secret contains whitespace. This often indicates an extra newline or space is in the value" : "";
    if (!signatureFound) {
      if (suspectPayloadType) {
        throw new StripeSignatureVerificationError(header, payload, {
          message: "Webhook payload must be provided as a string or a Buffer (https://nodejs.org/api/buffer.html) instance representing the _raw_ request body.Payload was provided as a parsed JavaScript object instead. \nSignature verification is impossible without access to the original signed material. \n" + docsLocation + "\n" + whitespaceMessage
        });
      }
      throw new StripeSignatureVerificationError(header, payload, {
        message: "No signatures found matching the expected signature for payload. Are you passing the raw request body you received from Stripe? \n If a webhook request is being forwarded by a third-party tool, ensure that the exact request body, including JSON formatting and new line style, is preserved.\n" + docsLocation + "\n" + whitespaceMessage
      });
    }
    const timestampAge = Math.floor((typeof receivedAt === "number" ? receivedAt : Date.now()) / 1e3) - details.timestamp;
    if (tolerance > 0 && timestampAge > tolerance) {
      throw new StripeSignatureVerificationError(header, payload, {
        message: "Timestamp outside the tolerance zone"
      });
    }
    return true;
  }
  __name(validateComputedSignature, "validateComputedSignature");
  function parseHeader(header, scheme) {
    if (typeof header !== "string") {
      return null;
    }
    return header.split(",").reduce((accum, item) => {
      const kv = item.split("=");
      if (kv[0] === "t") {
        accum.timestamp = parseInt(kv[1], 10);
      }
      if (kv[0] === scheme) {
        accum.signatures.push(kv[1]);
      }
      return accum;
    }, {
      timestamp: -1,
      signatures: []
    });
  }
  __name(parseHeader, "parseHeader");
  let webhooksCryptoProviderInstance = null;
  function getCryptoProvider() {
    if (!webhooksCryptoProviderInstance) {
      webhooksCryptoProviderInstance = platformFunctions.createDefaultCryptoProvider();
    }
    return webhooksCryptoProviderInstance;
  }
  __name(getCryptoProvider, "getCryptoProvider");
  function prepareOptions(opts) {
    if (!opts) {
      throw new StripeError({
        message: "Options are required"
      });
    }
    const timestamp = Math.floor(opts.timestamp) || Math.floor(Date.now() / 1e3);
    const scheme = opts.scheme || signature.EXPECTED_SCHEME;
    const cryptoProvider = opts.cryptoProvider || getCryptoProvider();
    const payloadString = `${timestamp}.${opts.payload}`;
    const generateHeaderString = /* @__PURE__ */ __name((signature2) => {
      return `t=${timestamp},${scheme}=${signature2}`;
    }, "generateHeaderString");
    return Object.assign(Object.assign({}, opts), {
      timestamp,
      scheme,
      cryptoProvider,
      payloadString,
      generateHeaderString
    });
  }
  __name(prepareOptions, "prepareOptions");
  Webhook.signature = signature;
  return Webhook;
}
__name(createWebhooks, "createWebhooks");

// node_modules/stripe/esm/apiVersion.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var ApiVersion = "2025-10-29.clover";

// node_modules/stripe/esm/resources.js
var resources_exports = {};
__export(resources_exports, {
  Account: () => Accounts2,
  AccountLinks: () => AccountLinks,
  AccountSessions: () => AccountSessions,
  Accounts: () => Accounts2,
  ApplePayDomains: () => ApplePayDomains,
  ApplicationFees: () => ApplicationFees,
  Apps: () => Apps,
  Balance: () => Balance,
  BalanceSettings: () => BalanceSettings,
  BalanceTransactions: () => BalanceTransactions,
  Billing: () => Billing,
  BillingPortal: () => BillingPortal,
  Charges: () => Charges,
  Checkout: () => Checkout,
  Climate: () => Climate,
  ConfirmationTokens: () => ConfirmationTokens2,
  CountrySpecs: () => CountrySpecs,
  Coupons: () => Coupons,
  CreditNotes: () => CreditNotes,
  CustomerSessions: () => CustomerSessions,
  Customers: () => Customers2,
  Disputes: () => Disputes2,
  Entitlements: () => Entitlements,
  EphemeralKeys: () => EphemeralKeys,
  Events: () => Events2,
  ExchangeRates: () => ExchangeRates,
  FileLinks: () => FileLinks,
  Files: () => Files,
  FinancialConnections: () => FinancialConnections,
  Forwarding: () => Forwarding,
  Identity: () => Identity,
  InvoiceItems: () => InvoiceItems,
  InvoicePayments: () => InvoicePayments,
  InvoiceRenderingTemplates: () => InvoiceRenderingTemplates,
  Invoices: () => Invoices,
  Issuing: () => Issuing,
  Mandates: () => Mandates,
  OAuth: () => OAuth,
  PaymentAttemptRecords: () => PaymentAttemptRecords,
  PaymentIntents: () => PaymentIntents,
  PaymentLinks: () => PaymentLinks,
  PaymentMethodConfigurations: () => PaymentMethodConfigurations,
  PaymentMethodDomains: () => PaymentMethodDomains,
  PaymentMethods: () => PaymentMethods,
  PaymentRecords: () => PaymentRecords,
  Payouts: () => Payouts,
  Plans: () => Plans,
  Prices: () => Prices,
  Products: () => Products2,
  PromotionCodes: () => PromotionCodes,
  Quotes: () => Quotes,
  Radar: () => Radar,
  Refunds: () => Refunds2,
  Reporting: () => Reporting,
  Reviews: () => Reviews,
  SetupAttempts: () => SetupAttempts,
  SetupIntents: () => SetupIntents,
  ShippingRates: () => ShippingRates,
  Sigma: () => Sigma,
  Sources: () => Sources,
  SubscriptionItems: () => SubscriptionItems,
  SubscriptionSchedules: () => SubscriptionSchedules,
  Subscriptions: () => Subscriptions,
  Tax: () => Tax,
  TaxCodes: () => TaxCodes,
  TaxIds: () => TaxIds,
  TaxRates: () => TaxRates,
  Terminal: () => Terminal,
  TestHelpers: () => TestHelpers,
  Tokens: () => Tokens2,
  Topups: () => Topups,
  Transfers: () => Transfers,
  Treasury: () => Treasury,
  V2: () => V2,
  WebhookEndpoints: () => WebhookEndpoints
});
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/ResourceNamespace.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function ResourceNamespace(stripe, resources) {
  for (const name in resources) {
    if (!Object.prototype.hasOwnProperty.call(resources, name)) {
      continue;
    }
    const camelCaseName = name[0].toLowerCase() + name.substring(1);
    const resource = new resources[name](stripe);
    this[camelCaseName] = resource;
  }
}
__name(ResourceNamespace, "ResourceNamespace");
function resourceNamespace(namespace, resources) {
  return function(stripe) {
    return new ResourceNamespace(stripe, resources);
  };
}
__name(resourceNamespace, "resourceNamespace");

// node_modules/stripe/esm/resources/FinancialConnections/Accounts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod2 = StripeResource.method;
var Accounts = StripeResource.extend({
  retrieve: stripeMethod2({
    method: "GET",
    fullPath: "/v1/financial_connections/accounts/{account}"
  }),
  list: stripeMethod2({
    method: "GET",
    fullPath: "/v1/financial_connections/accounts",
    methodType: "list"
  }),
  disconnect: stripeMethod2({
    method: "POST",
    fullPath: "/v1/financial_connections/accounts/{account}/disconnect"
  }),
  listOwners: stripeMethod2({
    method: "GET",
    fullPath: "/v1/financial_connections/accounts/{account}/owners",
    methodType: "list"
  }),
  refresh: stripeMethod2({
    method: "POST",
    fullPath: "/v1/financial_connections/accounts/{account}/refresh"
  }),
  subscribe: stripeMethod2({
    method: "POST",
    fullPath: "/v1/financial_connections/accounts/{account}/subscribe"
  }),
  unsubscribe: stripeMethod2({
    method: "POST",
    fullPath: "/v1/financial_connections/accounts/{account}/unsubscribe"
  })
});

// node_modules/stripe/esm/resources/Entitlements/ActiveEntitlements.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod3 = StripeResource.method;
var ActiveEntitlements = StripeResource.extend({
  retrieve: stripeMethod3({
    method: "GET",
    fullPath: "/v1/entitlements/active_entitlements/{id}"
  }),
  list: stripeMethod3({
    method: "GET",
    fullPath: "/v1/entitlements/active_entitlements",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Billing/Alerts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod4 = StripeResource.method;
var Alerts = StripeResource.extend({
  create: stripeMethod4({ method: "POST", fullPath: "/v1/billing/alerts" }),
  retrieve: stripeMethod4({ method: "GET", fullPath: "/v1/billing/alerts/{id}" }),
  list: stripeMethod4({
    method: "GET",
    fullPath: "/v1/billing/alerts",
    methodType: "list"
  }),
  activate: stripeMethod4({
    method: "POST",
    fullPath: "/v1/billing/alerts/{id}/activate"
  }),
  archive: stripeMethod4({
    method: "POST",
    fullPath: "/v1/billing/alerts/{id}/archive"
  }),
  deactivate: stripeMethod4({
    method: "POST",
    fullPath: "/v1/billing/alerts/{id}/deactivate"
  })
});

// node_modules/stripe/esm/resources/Issuing/Authorizations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod5 = StripeResource.method;
var Authorizations = StripeResource.extend({
  retrieve: stripeMethod5({
    method: "GET",
    fullPath: "/v1/issuing/authorizations/{authorization}"
  }),
  update: stripeMethod5({
    method: "POST",
    fullPath: "/v1/issuing/authorizations/{authorization}"
  }),
  list: stripeMethod5({
    method: "GET",
    fullPath: "/v1/issuing/authorizations",
    methodType: "list"
  }),
  approve: stripeMethod5({
    method: "POST",
    fullPath: "/v1/issuing/authorizations/{authorization}/approve"
  }),
  decline: stripeMethod5({
    method: "POST",
    fullPath: "/v1/issuing/authorizations/{authorization}/decline"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Issuing/Authorizations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod6 = StripeResource.method;
var Authorizations2 = StripeResource.extend({
  create: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations"
  }),
  capture: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/capture"
  }),
  expire: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/expire"
  }),
  finalizeAmount: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/finalize_amount"
  }),
  increment: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/increment"
  }),
  respond: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/fraud_challenges/respond"
  }),
  reverse: stripeMethod6({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/authorizations/{authorization}/reverse"
  })
});

// node_modules/stripe/esm/resources/Tax/Calculations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod7 = StripeResource.method;
var Calculations = StripeResource.extend({
  create: stripeMethod7({ method: "POST", fullPath: "/v1/tax/calculations" }),
  retrieve: stripeMethod7({
    method: "GET",
    fullPath: "/v1/tax/calculations/{calculation}"
  }),
  listLineItems: stripeMethod7({
    method: "GET",
    fullPath: "/v1/tax/calculations/{calculation}/line_items",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Issuing/Cardholders.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod8 = StripeResource.method;
var Cardholders = StripeResource.extend({
  create: stripeMethod8({ method: "POST", fullPath: "/v1/issuing/cardholders" }),
  retrieve: stripeMethod8({
    method: "GET",
    fullPath: "/v1/issuing/cardholders/{cardholder}"
  }),
  update: stripeMethod8({
    method: "POST",
    fullPath: "/v1/issuing/cardholders/{cardholder}"
  }),
  list: stripeMethod8({
    method: "GET",
    fullPath: "/v1/issuing/cardholders",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Issuing/Cards.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod9 = StripeResource.method;
var Cards = StripeResource.extend({
  create: stripeMethod9({ method: "POST", fullPath: "/v1/issuing/cards" }),
  retrieve: stripeMethod9({ method: "GET", fullPath: "/v1/issuing/cards/{card}" }),
  update: stripeMethod9({ method: "POST", fullPath: "/v1/issuing/cards/{card}" }),
  list: stripeMethod9({
    method: "GET",
    fullPath: "/v1/issuing/cards",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Issuing/Cards.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod10 = StripeResource.method;
var Cards2 = StripeResource.extend({
  deliverCard: stripeMethod10({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/deliver"
  }),
  failCard: stripeMethod10({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/fail"
  }),
  returnCard: stripeMethod10({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/return"
  }),
  shipCard: stripeMethod10({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/ship"
  }),
  submitCard: stripeMethod10({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/cards/{card}/shipping/submit"
  })
});

// node_modules/stripe/esm/resources/BillingPortal/Configurations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod11 = StripeResource.method;
var Configurations = StripeResource.extend({
  create: stripeMethod11({
    method: "POST",
    fullPath: "/v1/billing_portal/configurations"
  }),
  retrieve: stripeMethod11({
    method: "GET",
    fullPath: "/v1/billing_portal/configurations/{configuration}"
  }),
  update: stripeMethod11({
    method: "POST",
    fullPath: "/v1/billing_portal/configurations/{configuration}"
  }),
  list: stripeMethod11({
    method: "GET",
    fullPath: "/v1/billing_portal/configurations",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Terminal/Configurations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod12 = StripeResource.method;
var Configurations2 = StripeResource.extend({
  create: stripeMethod12({
    method: "POST",
    fullPath: "/v1/terminal/configurations"
  }),
  retrieve: stripeMethod12({
    method: "GET",
    fullPath: "/v1/terminal/configurations/{configuration}"
  }),
  update: stripeMethod12({
    method: "POST",
    fullPath: "/v1/terminal/configurations/{configuration}"
  }),
  list: stripeMethod12({
    method: "GET",
    fullPath: "/v1/terminal/configurations",
    methodType: "list"
  }),
  del: stripeMethod12({
    method: "DELETE",
    fullPath: "/v1/terminal/configurations/{configuration}"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/ConfirmationTokens.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod13 = StripeResource.method;
var ConfirmationTokens = StripeResource.extend({
  create: stripeMethod13({
    method: "POST",
    fullPath: "/v1/test_helpers/confirmation_tokens"
  })
});

// node_modules/stripe/esm/resources/Terminal/ConnectionTokens.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod14 = StripeResource.method;
var ConnectionTokens = StripeResource.extend({
  create: stripeMethod14({
    method: "POST",
    fullPath: "/v1/terminal/connection_tokens"
  })
});

// node_modules/stripe/esm/resources/Billing/CreditBalanceSummary.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod15 = StripeResource.method;
var CreditBalanceSummary = StripeResource.extend({
  retrieve: stripeMethod15({
    method: "GET",
    fullPath: "/v1/billing/credit_balance_summary"
  })
});

// node_modules/stripe/esm/resources/Billing/CreditBalanceTransactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod16 = StripeResource.method;
var CreditBalanceTransactions = StripeResource.extend({
  retrieve: stripeMethod16({
    method: "GET",
    fullPath: "/v1/billing/credit_balance_transactions/{id}"
  }),
  list: stripeMethod16({
    method: "GET",
    fullPath: "/v1/billing/credit_balance_transactions",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Billing/CreditGrants.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod17 = StripeResource.method;
var CreditGrants = StripeResource.extend({
  create: stripeMethod17({ method: "POST", fullPath: "/v1/billing/credit_grants" }),
  retrieve: stripeMethod17({
    method: "GET",
    fullPath: "/v1/billing/credit_grants/{id}"
  }),
  update: stripeMethod17({
    method: "POST",
    fullPath: "/v1/billing/credit_grants/{id}"
  }),
  list: stripeMethod17({
    method: "GET",
    fullPath: "/v1/billing/credit_grants",
    methodType: "list"
  }),
  expire: stripeMethod17({
    method: "POST",
    fullPath: "/v1/billing/credit_grants/{id}/expire"
  }),
  voidGrant: stripeMethod17({
    method: "POST",
    fullPath: "/v1/billing/credit_grants/{id}/void"
  })
});

// node_modules/stripe/esm/resources/Treasury/CreditReversals.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod18 = StripeResource.method;
var CreditReversals = StripeResource.extend({
  create: stripeMethod18({
    method: "POST",
    fullPath: "/v1/treasury/credit_reversals"
  }),
  retrieve: stripeMethod18({
    method: "GET",
    fullPath: "/v1/treasury/credit_reversals/{credit_reversal}"
  }),
  list: stripeMethod18({
    method: "GET",
    fullPath: "/v1/treasury/credit_reversals",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Customers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod19 = StripeResource.method;
var Customers = StripeResource.extend({
  fundCashBalance: stripeMethod19({
    method: "POST",
    fullPath: "/v1/test_helpers/customers/{customer}/fund_cash_balance"
  })
});

// node_modules/stripe/esm/resources/Treasury/DebitReversals.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod20 = StripeResource.method;
var DebitReversals = StripeResource.extend({
  create: stripeMethod20({
    method: "POST",
    fullPath: "/v1/treasury/debit_reversals"
  }),
  retrieve: stripeMethod20({
    method: "GET",
    fullPath: "/v1/treasury/debit_reversals/{debit_reversal}"
  }),
  list: stripeMethod20({
    method: "GET",
    fullPath: "/v1/treasury/debit_reversals",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Issuing/Disputes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod21 = StripeResource.method;
var Disputes = StripeResource.extend({
  create: stripeMethod21({ method: "POST", fullPath: "/v1/issuing/disputes" }),
  retrieve: stripeMethod21({
    method: "GET",
    fullPath: "/v1/issuing/disputes/{dispute}"
  }),
  update: stripeMethod21({
    method: "POST",
    fullPath: "/v1/issuing/disputes/{dispute}"
  }),
  list: stripeMethod21({
    method: "GET",
    fullPath: "/v1/issuing/disputes",
    methodType: "list"
  }),
  submit: stripeMethod21({
    method: "POST",
    fullPath: "/v1/issuing/disputes/{dispute}/submit"
  })
});

// node_modules/stripe/esm/resources/Radar/EarlyFraudWarnings.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod22 = StripeResource.method;
var EarlyFraudWarnings = StripeResource.extend({
  retrieve: stripeMethod22({
    method: "GET",
    fullPath: "/v1/radar/early_fraud_warnings/{early_fraud_warning}"
  }),
  list: stripeMethod22({
    method: "GET",
    fullPath: "/v1/radar/early_fraud_warnings",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/V2/Core/EventDestinations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod23 = StripeResource.method;
var EventDestinations = StripeResource.extend({
  create: stripeMethod23({
    method: "POST",
    fullPath: "/v2/core/event_destinations"
  }),
  retrieve: stripeMethod23({
    method: "GET",
    fullPath: "/v2/core/event_destinations/{id}"
  }),
  update: stripeMethod23({
    method: "POST",
    fullPath: "/v2/core/event_destinations/{id}"
  }),
  list: stripeMethod23({
    method: "GET",
    fullPath: "/v2/core/event_destinations",
    methodType: "list"
  }),
  del: stripeMethod23({
    method: "DELETE",
    fullPath: "/v2/core/event_destinations/{id}"
  }),
  disable: stripeMethod23({
    method: "POST",
    fullPath: "/v2/core/event_destinations/{id}/disable"
  }),
  enable: stripeMethod23({
    method: "POST",
    fullPath: "/v2/core/event_destinations/{id}/enable"
  }),
  ping: stripeMethod23({
    method: "POST",
    fullPath: "/v2/core/event_destinations/{id}/ping"
  })
});

// node_modules/stripe/esm/resources/V2/Core/Events.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod24 = StripeResource.method;
var Events = StripeResource.extend({
  retrieve(...args) {
    const transformResponseData = /* @__PURE__ */ __name((response) => {
      return this.addFetchRelatedObjectIfNeeded(response);
    }, "transformResponseData");
    return stripeMethod24({
      method: "GET",
      fullPath: "/v2/core/events/{id}",
      transformResponseData
    }).apply(this, args);
  },
  list(...args) {
    const transformResponseData = /* @__PURE__ */ __name((response) => {
      return Object.assign(Object.assign({}, response), { data: response.data.map(this.addFetchRelatedObjectIfNeeded.bind(this)) });
    }, "transformResponseData");
    return stripeMethod24({
      method: "GET",
      fullPath: "/v2/core/events",
      methodType: "list",
      transformResponseData
    }).apply(this, args);
  },
  /**
   * @private
   *
   * For internal use in stripe-node.
   *
   * @param pulledEvent The retrieved event object
   * @returns The retrieved event object with a fetchRelatedObject method,
   * if pulledEvent.related_object is valid (non-null and has a url)
   */
  addFetchRelatedObjectIfNeeded(pulledEvent) {
    if (!pulledEvent.related_object || !pulledEvent.related_object.url) {
      return pulledEvent;
    }
    return Object.assign(Object.assign({}, pulledEvent), { fetchRelatedObject: /* @__PURE__ */ __name(() => (
      // call stripeMethod with 'this' resource to fetch
      // the related object. 'this' is needed to construct
      // and send the request, but the method spec controls
      // the url endpoint and method, so it doesn't matter
      // that 'this' is an Events resource object here
      stripeMethod24({
        method: "GET",
        fullPath: pulledEvent.related_object.url
      }).apply(this, [
        {
          stripeContext: pulledEvent.context
        }
      ])
    ), "fetchRelatedObject") });
  }
});

// node_modules/stripe/esm/resources/Entitlements/Features.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod25 = StripeResource.method;
var Features = StripeResource.extend({
  create: stripeMethod25({ method: "POST", fullPath: "/v1/entitlements/features" }),
  retrieve: stripeMethod25({
    method: "GET",
    fullPath: "/v1/entitlements/features/{id}"
  }),
  update: stripeMethod25({
    method: "POST",
    fullPath: "/v1/entitlements/features/{id}"
  }),
  list: stripeMethod25({
    method: "GET",
    fullPath: "/v1/entitlements/features",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Treasury/FinancialAccounts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod26 = StripeResource.method;
var FinancialAccounts = StripeResource.extend({
  create: stripeMethod26({
    method: "POST",
    fullPath: "/v1/treasury/financial_accounts"
  }),
  retrieve: stripeMethod26({
    method: "GET",
    fullPath: "/v1/treasury/financial_accounts/{financial_account}"
  }),
  update: stripeMethod26({
    method: "POST",
    fullPath: "/v1/treasury/financial_accounts/{financial_account}"
  }),
  list: stripeMethod26({
    method: "GET",
    fullPath: "/v1/treasury/financial_accounts",
    methodType: "list"
  }),
  close: stripeMethod26({
    method: "POST",
    fullPath: "/v1/treasury/financial_accounts/{financial_account}/close"
  }),
  retrieveFeatures: stripeMethod26({
    method: "GET",
    fullPath: "/v1/treasury/financial_accounts/{financial_account}/features"
  }),
  updateFeatures: stripeMethod26({
    method: "POST",
    fullPath: "/v1/treasury/financial_accounts/{financial_account}/features"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Treasury/InboundTransfers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod27 = StripeResource.method;
var InboundTransfers = StripeResource.extend({
  fail: stripeMethod27({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/fail"
  }),
  returnInboundTransfer: stripeMethod27({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/return"
  }),
  succeed: stripeMethod27({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/inbound_transfers/{id}/succeed"
  })
});

// node_modules/stripe/esm/resources/Treasury/InboundTransfers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod28 = StripeResource.method;
var InboundTransfers2 = StripeResource.extend({
  create: stripeMethod28({
    method: "POST",
    fullPath: "/v1/treasury/inbound_transfers"
  }),
  retrieve: stripeMethod28({
    method: "GET",
    fullPath: "/v1/treasury/inbound_transfers/{id}"
  }),
  list: stripeMethod28({
    method: "GET",
    fullPath: "/v1/treasury/inbound_transfers",
    methodType: "list"
  }),
  cancel: stripeMethod28({
    method: "POST",
    fullPath: "/v1/treasury/inbound_transfers/{inbound_transfer}/cancel"
  })
});

// node_modules/stripe/esm/resources/Terminal/Locations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod29 = StripeResource.method;
var Locations = StripeResource.extend({
  create: stripeMethod29({ method: "POST", fullPath: "/v1/terminal/locations" }),
  retrieve: stripeMethod29({
    method: "GET",
    fullPath: "/v1/terminal/locations/{location}"
  }),
  update: stripeMethod29({
    method: "POST",
    fullPath: "/v1/terminal/locations/{location}"
  }),
  list: stripeMethod29({
    method: "GET",
    fullPath: "/v1/terminal/locations",
    methodType: "list"
  }),
  del: stripeMethod29({
    method: "DELETE",
    fullPath: "/v1/terminal/locations/{location}"
  })
});

// node_modules/stripe/esm/resources/Billing/MeterEventAdjustments.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod30 = StripeResource.method;
var MeterEventAdjustments = StripeResource.extend({
  create: stripeMethod30({
    method: "POST",
    fullPath: "/v1/billing/meter_event_adjustments"
  })
});

// node_modules/stripe/esm/resources/V2/Billing/MeterEventAdjustments.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod31 = StripeResource.method;
var MeterEventAdjustments2 = StripeResource.extend({
  create: stripeMethod31({
    method: "POST",
    fullPath: "/v2/billing/meter_event_adjustments"
  })
});

// node_modules/stripe/esm/resources/V2/Billing/MeterEventSession.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod32 = StripeResource.method;
var MeterEventSession = StripeResource.extend({
  create: stripeMethod32({
    method: "POST",
    fullPath: "/v2/billing/meter_event_session"
  })
});

// node_modules/stripe/esm/resources/V2/Billing/MeterEventStream.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod33 = StripeResource.method;
var MeterEventStream = StripeResource.extend({
  create: stripeMethod33({
    method: "POST",
    fullPath: "/v2/billing/meter_event_stream",
    host: "meter-events.stripe.com"
  })
});

// node_modules/stripe/esm/resources/Billing/MeterEvents.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod34 = StripeResource.method;
var MeterEvents = StripeResource.extend({
  create: stripeMethod34({ method: "POST", fullPath: "/v1/billing/meter_events" })
});

// node_modules/stripe/esm/resources/V2/Billing/MeterEvents.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod35 = StripeResource.method;
var MeterEvents2 = StripeResource.extend({
  create: stripeMethod35({ method: "POST", fullPath: "/v2/billing/meter_events" })
});

// node_modules/stripe/esm/resources/Billing/Meters.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod36 = StripeResource.method;
var Meters = StripeResource.extend({
  create: stripeMethod36({ method: "POST", fullPath: "/v1/billing/meters" }),
  retrieve: stripeMethod36({ method: "GET", fullPath: "/v1/billing/meters/{id}" }),
  update: stripeMethod36({ method: "POST", fullPath: "/v1/billing/meters/{id}" }),
  list: stripeMethod36({
    method: "GET",
    fullPath: "/v1/billing/meters",
    methodType: "list"
  }),
  deactivate: stripeMethod36({
    method: "POST",
    fullPath: "/v1/billing/meters/{id}/deactivate"
  }),
  listEventSummaries: stripeMethod36({
    method: "GET",
    fullPath: "/v1/billing/meters/{id}/event_summaries",
    methodType: "list"
  }),
  reactivate: stripeMethod36({
    method: "POST",
    fullPath: "/v1/billing/meters/{id}/reactivate"
  })
});

// node_modules/stripe/esm/resources/Climate/Orders.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod37 = StripeResource.method;
var Orders = StripeResource.extend({
  create: stripeMethod37({ method: "POST", fullPath: "/v1/climate/orders" }),
  retrieve: stripeMethod37({
    method: "GET",
    fullPath: "/v1/climate/orders/{order}"
  }),
  update: stripeMethod37({
    method: "POST",
    fullPath: "/v1/climate/orders/{order}"
  }),
  list: stripeMethod37({
    method: "GET",
    fullPath: "/v1/climate/orders",
    methodType: "list"
  }),
  cancel: stripeMethod37({
    method: "POST",
    fullPath: "/v1/climate/orders/{order}/cancel"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Treasury/OutboundPayments.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod38 = StripeResource.method;
var OutboundPayments = StripeResource.extend({
  update: stripeMethod38({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}"
  }),
  fail: stripeMethod38({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/fail"
  }),
  post: stripeMethod38({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/post"
  }),
  returnOutboundPayment: stripeMethod38({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_payments/{id}/return"
  })
});

// node_modules/stripe/esm/resources/Treasury/OutboundPayments.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod39 = StripeResource.method;
var OutboundPayments2 = StripeResource.extend({
  create: stripeMethod39({
    method: "POST",
    fullPath: "/v1/treasury/outbound_payments"
  }),
  retrieve: stripeMethod39({
    method: "GET",
    fullPath: "/v1/treasury/outbound_payments/{id}"
  }),
  list: stripeMethod39({
    method: "GET",
    fullPath: "/v1/treasury/outbound_payments",
    methodType: "list"
  }),
  cancel: stripeMethod39({
    method: "POST",
    fullPath: "/v1/treasury/outbound_payments/{id}/cancel"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Treasury/OutboundTransfers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod40 = StripeResource.method;
var OutboundTransfers = StripeResource.extend({
  update: stripeMethod40({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}"
  }),
  fail: stripeMethod40({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/fail"
  }),
  post: stripeMethod40({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/post"
  }),
  returnOutboundTransfer: stripeMethod40({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/outbound_transfers/{outbound_transfer}/return"
  })
});

// node_modules/stripe/esm/resources/Treasury/OutboundTransfers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod41 = StripeResource.method;
var OutboundTransfers2 = StripeResource.extend({
  create: stripeMethod41({
    method: "POST",
    fullPath: "/v1/treasury/outbound_transfers"
  }),
  retrieve: stripeMethod41({
    method: "GET",
    fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}"
  }),
  list: stripeMethod41({
    method: "GET",
    fullPath: "/v1/treasury/outbound_transfers",
    methodType: "list"
  }),
  cancel: stripeMethod41({
    method: "POST",
    fullPath: "/v1/treasury/outbound_transfers/{outbound_transfer}/cancel"
  })
});

// node_modules/stripe/esm/resources/Issuing/PersonalizationDesigns.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod42 = StripeResource.method;
var PersonalizationDesigns = StripeResource.extend({
  create: stripeMethod42({
    method: "POST",
    fullPath: "/v1/issuing/personalization_designs"
  }),
  retrieve: stripeMethod42({
    method: "GET",
    fullPath: "/v1/issuing/personalization_designs/{personalization_design}"
  }),
  update: stripeMethod42({
    method: "POST",
    fullPath: "/v1/issuing/personalization_designs/{personalization_design}"
  }),
  list: stripeMethod42({
    method: "GET",
    fullPath: "/v1/issuing/personalization_designs",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Issuing/PersonalizationDesigns.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod43 = StripeResource.method;
var PersonalizationDesigns2 = StripeResource.extend({
  activate: stripeMethod43({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/activate"
  }),
  deactivate: stripeMethod43({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/deactivate"
  }),
  reject: stripeMethod43({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/personalization_designs/{personalization_design}/reject"
  })
});

// node_modules/stripe/esm/resources/Issuing/PhysicalBundles.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod44 = StripeResource.method;
var PhysicalBundles = StripeResource.extend({
  retrieve: stripeMethod44({
    method: "GET",
    fullPath: "/v1/issuing/physical_bundles/{physical_bundle}"
  }),
  list: stripeMethod44({
    method: "GET",
    fullPath: "/v1/issuing/physical_bundles",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Climate/Products.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod45 = StripeResource.method;
var Products = StripeResource.extend({
  retrieve: stripeMethod45({
    method: "GET",
    fullPath: "/v1/climate/products/{product}"
  }),
  list: stripeMethod45({
    method: "GET",
    fullPath: "/v1/climate/products",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Terminal/Readers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod46 = StripeResource.method;
var Readers = StripeResource.extend({
  create: stripeMethod46({ method: "POST", fullPath: "/v1/terminal/readers" }),
  retrieve: stripeMethod46({
    method: "GET",
    fullPath: "/v1/terminal/readers/{reader}"
  }),
  update: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}"
  }),
  list: stripeMethod46({
    method: "GET",
    fullPath: "/v1/terminal/readers",
    methodType: "list"
  }),
  del: stripeMethod46({
    method: "DELETE",
    fullPath: "/v1/terminal/readers/{reader}"
  }),
  cancelAction: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/cancel_action"
  }),
  collectInputs: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/collect_inputs"
  }),
  collectPaymentMethod: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/collect_payment_method"
  }),
  confirmPaymentIntent: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/confirm_payment_intent"
  }),
  processPaymentIntent: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/process_payment_intent"
  }),
  processSetupIntent: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/process_setup_intent"
  }),
  refundPayment: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/refund_payment"
  }),
  setReaderDisplay: stripeMethod46({
    method: "POST",
    fullPath: "/v1/terminal/readers/{reader}/set_reader_display"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Terminal/Readers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod47 = StripeResource.method;
var Readers2 = StripeResource.extend({
  presentPaymentMethod: stripeMethod47({
    method: "POST",
    fullPath: "/v1/test_helpers/terminal/readers/{reader}/present_payment_method"
  }),
  succeedInputCollection: stripeMethod47({
    method: "POST",
    fullPath: "/v1/test_helpers/terminal/readers/{reader}/succeed_input_collection"
  }),
  timeoutInputCollection: stripeMethod47({
    method: "POST",
    fullPath: "/v1/test_helpers/terminal/readers/{reader}/timeout_input_collection"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Treasury/ReceivedCredits.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod48 = StripeResource.method;
var ReceivedCredits = StripeResource.extend({
  create: stripeMethod48({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/received_credits"
  })
});

// node_modules/stripe/esm/resources/Treasury/ReceivedCredits.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod49 = StripeResource.method;
var ReceivedCredits2 = StripeResource.extend({
  retrieve: stripeMethod49({
    method: "GET",
    fullPath: "/v1/treasury/received_credits/{id}"
  }),
  list: stripeMethod49({
    method: "GET",
    fullPath: "/v1/treasury/received_credits",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Treasury/ReceivedDebits.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod50 = StripeResource.method;
var ReceivedDebits = StripeResource.extend({
  create: stripeMethod50({
    method: "POST",
    fullPath: "/v1/test_helpers/treasury/received_debits"
  })
});

// node_modules/stripe/esm/resources/Treasury/ReceivedDebits.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod51 = StripeResource.method;
var ReceivedDebits2 = StripeResource.extend({
  retrieve: stripeMethod51({
    method: "GET",
    fullPath: "/v1/treasury/received_debits/{id}"
  }),
  list: stripeMethod51({
    method: "GET",
    fullPath: "/v1/treasury/received_debits",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Refunds.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod52 = StripeResource.method;
var Refunds = StripeResource.extend({
  expire: stripeMethod52({
    method: "POST",
    fullPath: "/v1/test_helpers/refunds/{refund}/expire"
  })
});

// node_modules/stripe/esm/resources/Tax/Registrations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod53 = StripeResource.method;
var Registrations = StripeResource.extend({
  create: stripeMethod53({ method: "POST", fullPath: "/v1/tax/registrations" }),
  retrieve: stripeMethod53({
    method: "GET",
    fullPath: "/v1/tax/registrations/{id}"
  }),
  update: stripeMethod53({
    method: "POST",
    fullPath: "/v1/tax/registrations/{id}"
  }),
  list: stripeMethod53({
    method: "GET",
    fullPath: "/v1/tax/registrations",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Reporting/ReportRuns.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod54 = StripeResource.method;
var ReportRuns = StripeResource.extend({
  create: stripeMethod54({ method: "POST", fullPath: "/v1/reporting/report_runs" }),
  retrieve: stripeMethod54({
    method: "GET",
    fullPath: "/v1/reporting/report_runs/{report_run}"
  }),
  list: stripeMethod54({
    method: "GET",
    fullPath: "/v1/reporting/report_runs",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Reporting/ReportTypes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod55 = StripeResource.method;
var ReportTypes = StripeResource.extend({
  retrieve: stripeMethod55({
    method: "GET",
    fullPath: "/v1/reporting/report_types/{report_type}"
  }),
  list: stripeMethod55({
    method: "GET",
    fullPath: "/v1/reporting/report_types",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Forwarding/Requests.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod56 = StripeResource.method;
var Requests = StripeResource.extend({
  create: stripeMethod56({ method: "POST", fullPath: "/v1/forwarding/requests" }),
  retrieve: stripeMethod56({
    method: "GET",
    fullPath: "/v1/forwarding/requests/{id}"
  }),
  list: stripeMethod56({
    method: "GET",
    fullPath: "/v1/forwarding/requests",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Sigma/ScheduledQueryRuns.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod57 = StripeResource.method;
var ScheduledQueryRuns = StripeResource.extend({
  retrieve: stripeMethod57({
    method: "GET",
    fullPath: "/v1/sigma/scheduled_query_runs/{scheduled_query_run}"
  }),
  list: stripeMethod57({
    method: "GET",
    fullPath: "/v1/sigma/scheduled_query_runs",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Apps/Secrets.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod58 = StripeResource.method;
var Secrets = StripeResource.extend({
  create: stripeMethod58({ method: "POST", fullPath: "/v1/apps/secrets" }),
  list: stripeMethod58({
    method: "GET",
    fullPath: "/v1/apps/secrets",
    methodType: "list"
  }),
  deleteWhere: stripeMethod58({
    method: "POST",
    fullPath: "/v1/apps/secrets/delete"
  }),
  find: stripeMethod58({ method: "GET", fullPath: "/v1/apps/secrets/find" })
});

// node_modules/stripe/esm/resources/BillingPortal/Sessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod59 = StripeResource.method;
var Sessions = StripeResource.extend({
  create: stripeMethod59({
    method: "POST",
    fullPath: "/v1/billing_portal/sessions"
  })
});

// node_modules/stripe/esm/resources/Checkout/Sessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod60 = StripeResource.method;
var Sessions2 = StripeResource.extend({
  create: stripeMethod60({ method: "POST", fullPath: "/v1/checkout/sessions" }),
  retrieve: stripeMethod60({
    method: "GET",
    fullPath: "/v1/checkout/sessions/{session}"
  }),
  update: stripeMethod60({
    method: "POST",
    fullPath: "/v1/checkout/sessions/{session}"
  }),
  list: stripeMethod60({
    method: "GET",
    fullPath: "/v1/checkout/sessions",
    methodType: "list"
  }),
  expire: stripeMethod60({
    method: "POST",
    fullPath: "/v1/checkout/sessions/{session}/expire"
  }),
  listLineItems: stripeMethod60({
    method: "GET",
    fullPath: "/v1/checkout/sessions/{session}/line_items",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/FinancialConnections/Sessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod61 = StripeResource.method;
var Sessions3 = StripeResource.extend({
  create: stripeMethod61({
    method: "POST",
    fullPath: "/v1/financial_connections/sessions"
  }),
  retrieve: stripeMethod61({
    method: "GET",
    fullPath: "/v1/financial_connections/sessions/{session}"
  })
});

// node_modules/stripe/esm/resources/Tax/Settings.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod62 = StripeResource.method;
var Settings = StripeResource.extend({
  retrieve: stripeMethod62({ method: "GET", fullPath: "/v1/tax/settings" }),
  update: stripeMethod62({ method: "POST", fullPath: "/v1/tax/settings" })
});

// node_modules/stripe/esm/resources/Climate/Suppliers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod63 = StripeResource.method;
var Suppliers = StripeResource.extend({
  retrieve: stripeMethod63({
    method: "GET",
    fullPath: "/v1/climate/suppliers/{supplier}"
  }),
  list: stripeMethod63({
    method: "GET",
    fullPath: "/v1/climate/suppliers",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/TestClocks.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod64 = StripeResource.method;
var TestClocks = StripeResource.extend({
  create: stripeMethod64({
    method: "POST",
    fullPath: "/v1/test_helpers/test_clocks"
  }),
  retrieve: stripeMethod64({
    method: "GET",
    fullPath: "/v1/test_helpers/test_clocks/{test_clock}"
  }),
  list: stripeMethod64({
    method: "GET",
    fullPath: "/v1/test_helpers/test_clocks",
    methodType: "list"
  }),
  del: stripeMethod64({
    method: "DELETE",
    fullPath: "/v1/test_helpers/test_clocks/{test_clock}"
  }),
  advance: stripeMethod64({
    method: "POST",
    fullPath: "/v1/test_helpers/test_clocks/{test_clock}/advance"
  })
});

// node_modules/stripe/esm/resources/Issuing/Tokens.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod65 = StripeResource.method;
var Tokens = StripeResource.extend({
  retrieve: stripeMethod65({
    method: "GET",
    fullPath: "/v1/issuing/tokens/{token}"
  }),
  update: stripeMethod65({
    method: "POST",
    fullPath: "/v1/issuing/tokens/{token}"
  }),
  list: stripeMethod65({
    method: "GET",
    fullPath: "/v1/issuing/tokens",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Treasury/TransactionEntries.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod66 = StripeResource.method;
var TransactionEntries = StripeResource.extend({
  retrieve: stripeMethod66({
    method: "GET",
    fullPath: "/v1/treasury/transaction_entries/{id}"
  }),
  list: stripeMethod66({
    method: "GET",
    fullPath: "/v1/treasury/transaction_entries",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/FinancialConnections/Transactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod67 = StripeResource.method;
var Transactions = StripeResource.extend({
  retrieve: stripeMethod67({
    method: "GET",
    fullPath: "/v1/financial_connections/transactions/{transaction}"
  }),
  list: stripeMethod67({
    method: "GET",
    fullPath: "/v1/financial_connections/transactions",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Issuing/Transactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod68 = StripeResource.method;
var Transactions2 = StripeResource.extend({
  retrieve: stripeMethod68({
    method: "GET",
    fullPath: "/v1/issuing/transactions/{transaction}"
  }),
  update: stripeMethod68({
    method: "POST",
    fullPath: "/v1/issuing/transactions/{transaction}"
  }),
  list: stripeMethod68({
    method: "GET",
    fullPath: "/v1/issuing/transactions",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Tax/Transactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod69 = StripeResource.method;
var Transactions3 = StripeResource.extend({
  retrieve: stripeMethod69({
    method: "GET",
    fullPath: "/v1/tax/transactions/{transaction}"
  }),
  createFromCalculation: stripeMethod69({
    method: "POST",
    fullPath: "/v1/tax/transactions/create_from_calculation"
  }),
  createReversal: stripeMethod69({
    method: "POST",
    fullPath: "/v1/tax/transactions/create_reversal"
  }),
  listLineItems: stripeMethod69({
    method: "GET",
    fullPath: "/v1/tax/transactions/{transaction}/line_items",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TestHelpers/Issuing/Transactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod70 = StripeResource.method;
var Transactions4 = StripeResource.extend({
  createForceCapture: stripeMethod70({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/transactions/create_force_capture"
  }),
  createUnlinkedRefund: stripeMethod70({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/transactions/create_unlinked_refund"
  }),
  refund: stripeMethod70({
    method: "POST",
    fullPath: "/v1/test_helpers/issuing/transactions/{transaction}/refund"
  })
});

// node_modules/stripe/esm/resources/Treasury/Transactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod71 = StripeResource.method;
var Transactions5 = StripeResource.extend({
  retrieve: stripeMethod71({
    method: "GET",
    fullPath: "/v1/treasury/transactions/{id}"
  }),
  list: stripeMethod71({
    method: "GET",
    fullPath: "/v1/treasury/transactions",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Radar/ValueListItems.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod72 = StripeResource.method;
var ValueListItems = StripeResource.extend({
  create: stripeMethod72({
    method: "POST",
    fullPath: "/v1/radar/value_list_items"
  }),
  retrieve: stripeMethod72({
    method: "GET",
    fullPath: "/v1/radar/value_list_items/{item}"
  }),
  list: stripeMethod72({
    method: "GET",
    fullPath: "/v1/radar/value_list_items",
    methodType: "list"
  }),
  del: stripeMethod72({
    method: "DELETE",
    fullPath: "/v1/radar/value_list_items/{item}"
  })
});

// node_modules/stripe/esm/resources/Radar/ValueLists.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod73 = StripeResource.method;
var ValueLists = StripeResource.extend({
  create: stripeMethod73({ method: "POST", fullPath: "/v1/radar/value_lists" }),
  retrieve: stripeMethod73({
    method: "GET",
    fullPath: "/v1/radar/value_lists/{value_list}"
  }),
  update: stripeMethod73({
    method: "POST",
    fullPath: "/v1/radar/value_lists/{value_list}"
  }),
  list: stripeMethod73({
    method: "GET",
    fullPath: "/v1/radar/value_lists",
    methodType: "list"
  }),
  del: stripeMethod73({
    method: "DELETE",
    fullPath: "/v1/radar/value_lists/{value_list}"
  })
});

// node_modules/stripe/esm/resources/Identity/VerificationReports.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod74 = StripeResource.method;
var VerificationReports = StripeResource.extend({
  retrieve: stripeMethod74({
    method: "GET",
    fullPath: "/v1/identity/verification_reports/{report}"
  }),
  list: stripeMethod74({
    method: "GET",
    fullPath: "/v1/identity/verification_reports",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Identity/VerificationSessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod75 = StripeResource.method;
var VerificationSessions = StripeResource.extend({
  create: stripeMethod75({
    method: "POST",
    fullPath: "/v1/identity/verification_sessions"
  }),
  retrieve: stripeMethod75({
    method: "GET",
    fullPath: "/v1/identity/verification_sessions/{session}"
  }),
  update: stripeMethod75({
    method: "POST",
    fullPath: "/v1/identity/verification_sessions/{session}"
  }),
  list: stripeMethod75({
    method: "GET",
    fullPath: "/v1/identity/verification_sessions",
    methodType: "list"
  }),
  cancel: stripeMethod75({
    method: "POST",
    fullPath: "/v1/identity/verification_sessions/{session}/cancel"
  }),
  redact: stripeMethod75({
    method: "POST",
    fullPath: "/v1/identity/verification_sessions/{session}/redact"
  })
});

// node_modules/stripe/esm/resources/Accounts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod76 = StripeResource.method;
var Accounts2 = StripeResource.extend({
  create: stripeMethod76({ method: "POST", fullPath: "/v1/accounts" }),
  retrieve(id, ...args) {
    if (typeof id === "string") {
      return stripeMethod76({
        method: "GET",
        fullPath: "/v1/accounts/{id}"
      }).apply(this, [id, ...args]);
    } else {
      if (id === null || id === void 0) {
        [].shift.apply([id, ...args]);
      }
      return stripeMethod76({
        method: "GET",
        fullPath: "/v1/account"
      }).apply(this, [id, ...args]);
    }
  },
  update: stripeMethod76({ method: "POST", fullPath: "/v1/accounts/{account}" }),
  list: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts",
    methodType: "list"
  }),
  del: stripeMethod76({ method: "DELETE", fullPath: "/v1/accounts/{account}" }),
  createExternalAccount: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/external_accounts"
  }),
  createLoginLink: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/login_links"
  }),
  createPerson: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/persons"
  }),
  deleteExternalAccount: stripeMethod76({
    method: "DELETE",
    fullPath: "/v1/accounts/{account}/external_accounts/{id}"
  }),
  deletePerson: stripeMethod76({
    method: "DELETE",
    fullPath: "/v1/accounts/{account}/persons/{person}"
  }),
  listCapabilities: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/capabilities",
    methodType: "list"
  }),
  listExternalAccounts: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/external_accounts",
    methodType: "list"
  }),
  listPersons: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/persons",
    methodType: "list"
  }),
  reject: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/reject"
  }),
  retrieveCurrent: stripeMethod76({ method: "GET", fullPath: "/v1/account" }),
  retrieveCapability: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/capabilities/{capability}"
  }),
  retrieveExternalAccount: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/external_accounts/{id}"
  }),
  retrievePerson: stripeMethod76({
    method: "GET",
    fullPath: "/v1/accounts/{account}/persons/{person}"
  }),
  updateCapability: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/capabilities/{capability}"
  }),
  updateExternalAccount: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/external_accounts/{id}"
  }),
  updatePerson: stripeMethod76({
    method: "POST",
    fullPath: "/v1/accounts/{account}/persons/{person}"
  })
});

// node_modules/stripe/esm/resources/AccountLinks.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod77 = StripeResource.method;
var AccountLinks = StripeResource.extend({
  create: stripeMethod77({ method: "POST", fullPath: "/v1/account_links" })
});

// node_modules/stripe/esm/resources/AccountSessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod78 = StripeResource.method;
var AccountSessions = StripeResource.extend({
  create: stripeMethod78({ method: "POST", fullPath: "/v1/account_sessions" })
});

// node_modules/stripe/esm/resources/ApplePayDomains.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod79 = StripeResource.method;
var ApplePayDomains = StripeResource.extend({
  create: stripeMethod79({ method: "POST", fullPath: "/v1/apple_pay/domains" }),
  retrieve: stripeMethod79({
    method: "GET",
    fullPath: "/v1/apple_pay/domains/{domain}"
  }),
  list: stripeMethod79({
    method: "GET",
    fullPath: "/v1/apple_pay/domains",
    methodType: "list"
  }),
  del: stripeMethod79({
    method: "DELETE",
    fullPath: "/v1/apple_pay/domains/{domain}"
  })
});

// node_modules/stripe/esm/resources/ApplicationFees.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod80 = StripeResource.method;
var ApplicationFees = StripeResource.extend({
  retrieve: stripeMethod80({
    method: "GET",
    fullPath: "/v1/application_fees/{id}"
  }),
  list: stripeMethod80({
    method: "GET",
    fullPath: "/v1/application_fees",
    methodType: "list"
  }),
  createRefund: stripeMethod80({
    method: "POST",
    fullPath: "/v1/application_fees/{id}/refunds"
  }),
  listRefunds: stripeMethod80({
    method: "GET",
    fullPath: "/v1/application_fees/{id}/refunds",
    methodType: "list"
  }),
  retrieveRefund: stripeMethod80({
    method: "GET",
    fullPath: "/v1/application_fees/{fee}/refunds/{id}"
  }),
  updateRefund: stripeMethod80({
    method: "POST",
    fullPath: "/v1/application_fees/{fee}/refunds/{id}"
  })
});

// node_modules/stripe/esm/resources/Balance.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod81 = StripeResource.method;
var Balance = StripeResource.extend({
  retrieve: stripeMethod81({ method: "GET", fullPath: "/v1/balance" })
});

// node_modules/stripe/esm/resources/BalanceSettings.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod82 = StripeResource.method;
var BalanceSettings = StripeResource.extend({
  retrieve: stripeMethod82({ method: "GET", fullPath: "/v1/balance_settings" }),
  update: stripeMethod82({ method: "POST", fullPath: "/v1/balance_settings" })
});

// node_modules/stripe/esm/resources/BalanceTransactions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod83 = StripeResource.method;
var BalanceTransactions = StripeResource.extend({
  retrieve: stripeMethod83({
    method: "GET",
    fullPath: "/v1/balance_transactions/{id}"
  }),
  list: stripeMethod83({
    method: "GET",
    fullPath: "/v1/balance_transactions",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Charges.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod84 = StripeResource.method;
var Charges = StripeResource.extend({
  create: stripeMethod84({ method: "POST", fullPath: "/v1/charges" }),
  retrieve: stripeMethod84({ method: "GET", fullPath: "/v1/charges/{charge}" }),
  update: stripeMethod84({ method: "POST", fullPath: "/v1/charges/{charge}" }),
  list: stripeMethod84({
    method: "GET",
    fullPath: "/v1/charges",
    methodType: "list"
  }),
  capture: stripeMethod84({
    method: "POST",
    fullPath: "/v1/charges/{charge}/capture"
  }),
  search: stripeMethod84({
    method: "GET",
    fullPath: "/v1/charges/search",
    methodType: "search"
  })
});

// node_modules/stripe/esm/resources/ConfirmationTokens.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod85 = StripeResource.method;
var ConfirmationTokens2 = StripeResource.extend({
  retrieve: stripeMethod85({
    method: "GET",
    fullPath: "/v1/confirmation_tokens/{confirmation_token}"
  })
});

// node_modules/stripe/esm/resources/CountrySpecs.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod86 = StripeResource.method;
var CountrySpecs = StripeResource.extend({
  retrieve: stripeMethod86({
    method: "GET",
    fullPath: "/v1/country_specs/{country}"
  }),
  list: stripeMethod86({
    method: "GET",
    fullPath: "/v1/country_specs",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Coupons.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod87 = StripeResource.method;
var Coupons = StripeResource.extend({
  create: stripeMethod87({ method: "POST", fullPath: "/v1/coupons" }),
  retrieve: stripeMethod87({ method: "GET", fullPath: "/v1/coupons/{coupon}" }),
  update: stripeMethod87({ method: "POST", fullPath: "/v1/coupons/{coupon}" }),
  list: stripeMethod87({
    method: "GET",
    fullPath: "/v1/coupons",
    methodType: "list"
  }),
  del: stripeMethod87({ method: "DELETE", fullPath: "/v1/coupons/{coupon}" })
});

// node_modules/stripe/esm/resources/CreditNotes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod88 = StripeResource.method;
var CreditNotes = StripeResource.extend({
  create: stripeMethod88({ method: "POST", fullPath: "/v1/credit_notes" }),
  retrieve: stripeMethod88({ method: "GET", fullPath: "/v1/credit_notes/{id}" }),
  update: stripeMethod88({ method: "POST", fullPath: "/v1/credit_notes/{id}" }),
  list: stripeMethod88({
    method: "GET",
    fullPath: "/v1/credit_notes",
    methodType: "list"
  }),
  listLineItems: stripeMethod88({
    method: "GET",
    fullPath: "/v1/credit_notes/{credit_note}/lines",
    methodType: "list"
  }),
  listPreviewLineItems: stripeMethod88({
    method: "GET",
    fullPath: "/v1/credit_notes/preview/lines",
    methodType: "list"
  }),
  preview: stripeMethod88({ method: "GET", fullPath: "/v1/credit_notes/preview" }),
  voidCreditNote: stripeMethod88({
    method: "POST",
    fullPath: "/v1/credit_notes/{id}/void"
  })
});

// node_modules/stripe/esm/resources/CustomerSessions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod89 = StripeResource.method;
var CustomerSessions = StripeResource.extend({
  create: stripeMethod89({ method: "POST", fullPath: "/v1/customer_sessions" })
});

// node_modules/stripe/esm/resources/Customers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod90 = StripeResource.method;
var Customers2 = StripeResource.extend({
  create: stripeMethod90({ method: "POST", fullPath: "/v1/customers" }),
  retrieve: stripeMethod90({ method: "GET", fullPath: "/v1/customers/{customer}" }),
  update: stripeMethod90({ method: "POST", fullPath: "/v1/customers/{customer}" }),
  list: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers",
    methodType: "list"
  }),
  del: stripeMethod90({ method: "DELETE", fullPath: "/v1/customers/{customer}" }),
  createBalanceTransaction: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/balance_transactions"
  }),
  createFundingInstructions: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/funding_instructions"
  }),
  createSource: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/sources"
  }),
  createTaxId: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/tax_ids"
  }),
  deleteDiscount: stripeMethod90({
    method: "DELETE",
    fullPath: "/v1/customers/{customer}/discount"
  }),
  deleteSource: stripeMethod90({
    method: "DELETE",
    fullPath: "/v1/customers/{customer}/sources/{id}"
  }),
  deleteTaxId: stripeMethod90({
    method: "DELETE",
    fullPath: "/v1/customers/{customer}/tax_ids/{id}"
  }),
  listBalanceTransactions: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/balance_transactions",
    methodType: "list"
  }),
  listCashBalanceTransactions: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/cash_balance_transactions",
    methodType: "list"
  }),
  listPaymentMethods: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/payment_methods",
    methodType: "list"
  }),
  listSources: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/sources",
    methodType: "list"
  }),
  listTaxIds: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/tax_ids",
    methodType: "list"
  }),
  retrieveBalanceTransaction: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}"
  }),
  retrieveCashBalance: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/cash_balance"
  }),
  retrieveCashBalanceTransaction: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/cash_balance_transactions/{transaction}"
  }),
  retrievePaymentMethod: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/payment_methods/{payment_method}"
  }),
  retrieveSource: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/sources/{id}"
  }),
  retrieveTaxId: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/{customer}/tax_ids/{id}"
  }),
  search: stripeMethod90({
    method: "GET",
    fullPath: "/v1/customers/search",
    methodType: "search"
  }),
  updateBalanceTransaction: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/balance_transactions/{transaction}"
  }),
  updateCashBalance: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/cash_balance"
  }),
  updateSource: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/sources/{id}"
  }),
  verifySource: stripeMethod90({
    method: "POST",
    fullPath: "/v1/customers/{customer}/sources/{id}/verify"
  })
});

// node_modules/stripe/esm/resources/Disputes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod91 = StripeResource.method;
var Disputes2 = StripeResource.extend({
  retrieve: stripeMethod91({ method: "GET", fullPath: "/v1/disputes/{dispute}" }),
  update: stripeMethod91({ method: "POST", fullPath: "/v1/disputes/{dispute}" }),
  list: stripeMethod91({
    method: "GET",
    fullPath: "/v1/disputes",
    methodType: "list"
  }),
  close: stripeMethod91({
    method: "POST",
    fullPath: "/v1/disputes/{dispute}/close"
  })
});

// node_modules/stripe/esm/resources/EphemeralKeys.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod92 = StripeResource.method;
var EphemeralKeys = StripeResource.extend({
  create: stripeMethod92({
    method: "POST",
    fullPath: "/v1/ephemeral_keys",
    validator: /* @__PURE__ */ __name((data, options) => {
      if (!options.headers || !options.headers["Stripe-Version"]) {
        throw new Error("Passing apiVersion in a separate options hash is required to create an ephemeral key. See https://stripe.com/docs/api/versioning?lang=node");
      }
    }, "validator")
  }),
  del: stripeMethod92({ method: "DELETE", fullPath: "/v1/ephemeral_keys/{key}" })
});

// node_modules/stripe/esm/resources/Events.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod93 = StripeResource.method;
var Events2 = StripeResource.extend({
  retrieve: stripeMethod93({ method: "GET", fullPath: "/v1/events/{id}" }),
  list: stripeMethod93({
    method: "GET",
    fullPath: "/v1/events",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/ExchangeRates.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod94 = StripeResource.method;
var ExchangeRates = StripeResource.extend({
  retrieve: stripeMethod94({
    method: "GET",
    fullPath: "/v1/exchange_rates/{rate_id}"
  }),
  list: stripeMethod94({
    method: "GET",
    fullPath: "/v1/exchange_rates",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/FileLinks.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod95 = StripeResource.method;
var FileLinks = StripeResource.extend({
  create: stripeMethod95({ method: "POST", fullPath: "/v1/file_links" }),
  retrieve: stripeMethod95({ method: "GET", fullPath: "/v1/file_links/{link}" }),
  update: stripeMethod95({ method: "POST", fullPath: "/v1/file_links/{link}" }),
  list: stripeMethod95({
    method: "GET",
    fullPath: "/v1/file_links",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Files.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// node_modules/stripe/esm/multipart.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var multipartDataGenerator = /* @__PURE__ */ __name((method, data, headers) => {
  const segno = (Math.round(Math.random() * 1e16) + Math.round(Math.random() * 1e16)).toString();
  headers["Content-Type"] = `multipart/form-data; boundary=${segno}`;
  const textEncoder = new TextEncoder();
  let buffer = new Uint8Array(0);
  const endBuffer = textEncoder.encode("\r\n");
  function push(l) {
    const prevBuffer = buffer;
    const newBuffer = l instanceof Uint8Array ? l : new Uint8Array(textEncoder.encode(l));
    buffer = new Uint8Array(prevBuffer.length + newBuffer.length + 2);
    buffer.set(prevBuffer);
    buffer.set(newBuffer, prevBuffer.length);
    buffer.set(endBuffer, buffer.length - 2);
  }
  __name(push, "push");
  function q(s) {
    return `"${s.replace(/"|"/g, "%22").replace(/\r\n|\r|\n/g, " ")}"`;
  }
  __name(q, "q");
  const flattenedData = flattenAndStringify(data);
  for (const k in flattenedData) {
    if (!Object.prototype.hasOwnProperty.call(flattenedData, k)) {
      continue;
    }
    const v = flattenedData[k];
    push(`--${segno}`);
    if (Object.prototype.hasOwnProperty.call(v, "data")) {
      const typedEntry = v;
      push(`Content-Disposition: form-data; name=${q(k)}; filename=${q(typedEntry.name || "blob")}`);
      push(`Content-Type: ${typedEntry.type || "application/octet-stream"}`);
      push("");
      push(typedEntry.data);
    } else {
      push(`Content-Disposition: form-data; name=${q(k)}`);
      push("");
      push(v);
    }
  }
  push(`--${segno}--`);
  return buffer;
}, "multipartDataGenerator");
function multipartRequestDataProcessor(method, data, headers, callback) {
  data = data || {};
  if (method !== "POST") {
    return callback(null, queryStringifyRequestData(data));
  }
  this._stripe._platformFunctions.tryBufferData(data).then((bufferedData) => {
    const buffer = multipartDataGenerator(method, bufferedData, headers);
    return callback(null, buffer);
  }).catch((err) => callback(err, null));
}
__name(multipartRequestDataProcessor, "multipartRequestDataProcessor");

// node_modules/stripe/esm/resources/Files.js
var stripeMethod96 = StripeResource.method;
var Files = StripeResource.extend({
  create: stripeMethod96({
    method: "POST",
    fullPath: "/v1/files",
    headers: {
      "Content-Type": "multipart/form-data"
    },
    host: "files.stripe.com"
  }),
  retrieve: stripeMethod96({ method: "GET", fullPath: "/v1/files/{file}" }),
  list: stripeMethod96({
    method: "GET",
    fullPath: "/v1/files",
    methodType: "list"
  }),
  requestDataProcessor: multipartRequestDataProcessor
});

// node_modules/stripe/esm/resources/InvoiceItems.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod97 = StripeResource.method;
var InvoiceItems = StripeResource.extend({
  create: stripeMethod97({ method: "POST", fullPath: "/v1/invoiceitems" }),
  retrieve: stripeMethod97({
    method: "GET",
    fullPath: "/v1/invoiceitems/{invoiceitem}"
  }),
  update: stripeMethod97({
    method: "POST",
    fullPath: "/v1/invoiceitems/{invoiceitem}"
  }),
  list: stripeMethod97({
    method: "GET",
    fullPath: "/v1/invoiceitems",
    methodType: "list"
  }),
  del: stripeMethod97({
    method: "DELETE",
    fullPath: "/v1/invoiceitems/{invoiceitem}"
  })
});

// node_modules/stripe/esm/resources/InvoicePayments.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod98 = StripeResource.method;
var InvoicePayments = StripeResource.extend({
  retrieve: stripeMethod98({
    method: "GET",
    fullPath: "/v1/invoice_payments/{invoice_payment}"
  }),
  list: stripeMethod98({
    method: "GET",
    fullPath: "/v1/invoice_payments",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/InvoiceRenderingTemplates.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod99 = StripeResource.method;
var InvoiceRenderingTemplates = StripeResource.extend({
  retrieve: stripeMethod99({
    method: "GET",
    fullPath: "/v1/invoice_rendering_templates/{template}"
  }),
  list: stripeMethod99({
    method: "GET",
    fullPath: "/v1/invoice_rendering_templates",
    methodType: "list"
  }),
  archive: stripeMethod99({
    method: "POST",
    fullPath: "/v1/invoice_rendering_templates/{template}/archive"
  }),
  unarchive: stripeMethod99({
    method: "POST",
    fullPath: "/v1/invoice_rendering_templates/{template}/unarchive"
  })
});

// node_modules/stripe/esm/resources/Invoices.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod100 = StripeResource.method;
var Invoices = StripeResource.extend({
  create: stripeMethod100({ method: "POST", fullPath: "/v1/invoices" }),
  retrieve: stripeMethod100({ method: "GET", fullPath: "/v1/invoices/{invoice}" }),
  update: stripeMethod100({ method: "POST", fullPath: "/v1/invoices/{invoice}" }),
  list: stripeMethod100({
    method: "GET",
    fullPath: "/v1/invoices",
    methodType: "list"
  }),
  del: stripeMethod100({ method: "DELETE", fullPath: "/v1/invoices/{invoice}" }),
  addLines: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/add_lines"
  }),
  attachPayment: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/attach_payment"
  }),
  createPreview: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/create_preview"
  }),
  finalizeInvoice: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/finalize"
  }),
  listLineItems: stripeMethod100({
    method: "GET",
    fullPath: "/v1/invoices/{invoice}/lines",
    methodType: "list"
  }),
  markUncollectible: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/mark_uncollectible"
  }),
  pay: stripeMethod100({ method: "POST", fullPath: "/v1/invoices/{invoice}/pay" }),
  removeLines: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/remove_lines"
  }),
  search: stripeMethod100({
    method: "GET",
    fullPath: "/v1/invoices/search",
    methodType: "search"
  }),
  sendInvoice: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/send"
  }),
  updateLines: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/update_lines"
  }),
  updateLineItem: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/lines/{line_item_id}"
  }),
  voidInvoice: stripeMethod100({
    method: "POST",
    fullPath: "/v1/invoices/{invoice}/void"
  })
});

// node_modules/stripe/esm/resources/Mandates.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod101 = StripeResource.method;
var Mandates = StripeResource.extend({
  retrieve: stripeMethod101({ method: "GET", fullPath: "/v1/mandates/{mandate}" })
});

// node_modules/stripe/esm/resources/OAuth.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod102 = StripeResource.method;
var oAuthHost = "connect.stripe.com";
var OAuth = StripeResource.extend({
  basePath: "/",
  authorizeUrl(params, options) {
    params = params || {};
    options = options || {};
    let path = "oauth/authorize";
    if (options.express) {
      path = `express/${path}`;
    }
    if (!params.response_type) {
      params.response_type = "code";
    }
    if (!params.client_id) {
      params.client_id = this._stripe.getClientId();
    }
    if (!params.scope) {
      params.scope = "read_write";
    }
    return `https://${oAuthHost}/${path}?${queryStringifyRequestData(params)}`;
  },
  token: stripeMethod102({
    method: "POST",
    path: "oauth/token",
    host: oAuthHost
  }),
  deauthorize(spec, ...args) {
    if (!spec.client_id) {
      spec.client_id = this._stripe.getClientId();
    }
    return stripeMethod102({
      method: "POST",
      path: "oauth/deauthorize",
      host: oAuthHost
    }).apply(this, [spec, ...args]);
  }
});

// node_modules/stripe/esm/resources/PaymentAttemptRecords.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod103 = StripeResource.method;
var PaymentAttemptRecords = StripeResource.extend({
  retrieve: stripeMethod103({
    method: "GET",
    fullPath: "/v1/payment_attempt_records/{id}"
  }),
  list: stripeMethod103({
    method: "GET",
    fullPath: "/v1/payment_attempt_records",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/PaymentIntents.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod104 = StripeResource.method;
var PaymentIntents = StripeResource.extend({
  create: stripeMethod104({ method: "POST", fullPath: "/v1/payment_intents" }),
  retrieve: stripeMethod104({
    method: "GET",
    fullPath: "/v1/payment_intents/{intent}"
  }),
  update: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}"
  }),
  list: stripeMethod104({
    method: "GET",
    fullPath: "/v1/payment_intents",
    methodType: "list"
  }),
  applyCustomerBalance: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/apply_customer_balance"
  }),
  cancel: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/cancel"
  }),
  capture: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/capture"
  }),
  confirm: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/confirm"
  }),
  incrementAuthorization: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/increment_authorization"
  }),
  listAmountDetailsLineItems: stripeMethod104({
    method: "GET",
    fullPath: "/v1/payment_intents/{intent}/amount_details_line_items",
    methodType: "list"
  }),
  search: stripeMethod104({
    method: "GET",
    fullPath: "/v1/payment_intents/search",
    methodType: "search"
  }),
  verifyMicrodeposits: stripeMethod104({
    method: "POST",
    fullPath: "/v1/payment_intents/{intent}/verify_microdeposits"
  })
});

// node_modules/stripe/esm/resources/PaymentLinks.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod105 = StripeResource.method;
var PaymentLinks = StripeResource.extend({
  create: stripeMethod105({ method: "POST", fullPath: "/v1/payment_links" }),
  retrieve: stripeMethod105({
    method: "GET",
    fullPath: "/v1/payment_links/{payment_link}"
  }),
  update: stripeMethod105({
    method: "POST",
    fullPath: "/v1/payment_links/{payment_link}"
  }),
  list: stripeMethod105({
    method: "GET",
    fullPath: "/v1/payment_links",
    methodType: "list"
  }),
  listLineItems: stripeMethod105({
    method: "GET",
    fullPath: "/v1/payment_links/{payment_link}/line_items",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/PaymentMethodConfigurations.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod106 = StripeResource.method;
var PaymentMethodConfigurations = StripeResource.extend({
  create: stripeMethod106({
    method: "POST",
    fullPath: "/v1/payment_method_configurations"
  }),
  retrieve: stripeMethod106({
    method: "GET",
    fullPath: "/v1/payment_method_configurations/{configuration}"
  }),
  update: stripeMethod106({
    method: "POST",
    fullPath: "/v1/payment_method_configurations/{configuration}"
  }),
  list: stripeMethod106({
    method: "GET",
    fullPath: "/v1/payment_method_configurations",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/PaymentMethodDomains.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod107 = StripeResource.method;
var PaymentMethodDomains = StripeResource.extend({
  create: stripeMethod107({
    method: "POST",
    fullPath: "/v1/payment_method_domains"
  }),
  retrieve: stripeMethod107({
    method: "GET",
    fullPath: "/v1/payment_method_domains/{payment_method_domain}"
  }),
  update: stripeMethod107({
    method: "POST",
    fullPath: "/v1/payment_method_domains/{payment_method_domain}"
  }),
  list: stripeMethod107({
    method: "GET",
    fullPath: "/v1/payment_method_domains",
    methodType: "list"
  }),
  validate: stripeMethod107({
    method: "POST",
    fullPath: "/v1/payment_method_domains/{payment_method_domain}/validate"
  })
});

// node_modules/stripe/esm/resources/PaymentMethods.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod108 = StripeResource.method;
var PaymentMethods = StripeResource.extend({
  create: stripeMethod108({ method: "POST", fullPath: "/v1/payment_methods" }),
  retrieve: stripeMethod108({
    method: "GET",
    fullPath: "/v1/payment_methods/{payment_method}"
  }),
  update: stripeMethod108({
    method: "POST",
    fullPath: "/v1/payment_methods/{payment_method}"
  }),
  list: stripeMethod108({
    method: "GET",
    fullPath: "/v1/payment_methods",
    methodType: "list"
  }),
  attach: stripeMethod108({
    method: "POST",
    fullPath: "/v1/payment_methods/{payment_method}/attach"
  }),
  detach: stripeMethod108({
    method: "POST",
    fullPath: "/v1/payment_methods/{payment_method}/detach"
  })
});

// node_modules/stripe/esm/resources/PaymentRecords.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod109 = StripeResource.method;
var PaymentRecords = StripeResource.extend({
  retrieve: stripeMethod109({ method: "GET", fullPath: "/v1/payment_records/{id}" }),
  reportPayment: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/report_payment"
  }),
  reportPaymentAttempt: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_payment_attempt"
  }),
  reportPaymentAttemptCanceled: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_payment_attempt_canceled"
  }),
  reportPaymentAttemptFailed: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_payment_attempt_failed"
  }),
  reportPaymentAttemptGuaranteed: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_payment_attempt_guaranteed"
  }),
  reportPaymentAttemptInformational: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_payment_attempt_informational"
  }),
  reportRefund: stripeMethod109({
    method: "POST",
    fullPath: "/v1/payment_records/{id}/report_refund"
  })
});

// node_modules/stripe/esm/resources/Payouts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod110 = StripeResource.method;
var Payouts = StripeResource.extend({
  create: stripeMethod110({ method: "POST", fullPath: "/v1/payouts" }),
  retrieve: stripeMethod110({ method: "GET", fullPath: "/v1/payouts/{payout}" }),
  update: stripeMethod110({ method: "POST", fullPath: "/v1/payouts/{payout}" }),
  list: stripeMethod110({
    method: "GET",
    fullPath: "/v1/payouts",
    methodType: "list"
  }),
  cancel: stripeMethod110({
    method: "POST",
    fullPath: "/v1/payouts/{payout}/cancel"
  }),
  reverse: stripeMethod110({
    method: "POST",
    fullPath: "/v1/payouts/{payout}/reverse"
  })
});

// node_modules/stripe/esm/resources/Plans.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod111 = StripeResource.method;
var Plans = StripeResource.extend({
  create: stripeMethod111({ method: "POST", fullPath: "/v1/plans" }),
  retrieve: stripeMethod111({ method: "GET", fullPath: "/v1/plans/{plan}" }),
  update: stripeMethod111({ method: "POST", fullPath: "/v1/plans/{plan}" }),
  list: stripeMethod111({
    method: "GET",
    fullPath: "/v1/plans",
    methodType: "list"
  }),
  del: stripeMethod111({ method: "DELETE", fullPath: "/v1/plans/{plan}" })
});

// node_modules/stripe/esm/resources/Prices.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod112 = StripeResource.method;
var Prices = StripeResource.extend({
  create: stripeMethod112({ method: "POST", fullPath: "/v1/prices" }),
  retrieve: stripeMethod112({ method: "GET", fullPath: "/v1/prices/{price}" }),
  update: stripeMethod112({ method: "POST", fullPath: "/v1/prices/{price}" }),
  list: stripeMethod112({
    method: "GET",
    fullPath: "/v1/prices",
    methodType: "list"
  }),
  search: stripeMethod112({
    method: "GET",
    fullPath: "/v1/prices/search",
    methodType: "search"
  })
});

// node_modules/stripe/esm/resources/Products.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod113 = StripeResource.method;
var Products2 = StripeResource.extend({
  create: stripeMethod113({ method: "POST", fullPath: "/v1/products" }),
  retrieve: stripeMethod113({ method: "GET", fullPath: "/v1/products/{id}" }),
  update: stripeMethod113({ method: "POST", fullPath: "/v1/products/{id}" }),
  list: stripeMethod113({
    method: "GET",
    fullPath: "/v1/products",
    methodType: "list"
  }),
  del: stripeMethod113({ method: "DELETE", fullPath: "/v1/products/{id}" }),
  createFeature: stripeMethod113({
    method: "POST",
    fullPath: "/v1/products/{product}/features"
  }),
  deleteFeature: stripeMethod113({
    method: "DELETE",
    fullPath: "/v1/products/{product}/features/{id}"
  }),
  listFeatures: stripeMethod113({
    method: "GET",
    fullPath: "/v1/products/{product}/features",
    methodType: "list"
  }),
  retrieveFeature: stripeMethod113({
    method: "GET",
    fullPath: "/v1/products/{product}/features/{id}"
  }),
  search: stripeMethod113({
    method: "GET",
    fullPath: "/v1/products/search",
    methodType: "search"
  })
});

// node_modules/stripe/esm/resources/PromotionCodes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod114 = StripeResource.method;
var PromotionCodes = StripeResource.extend({
  create: stripeMethod114({ method: "POST", fullPath: "/v1/promotion_codes" }),
  retrieve: stripeMethod114({
    method: "GET",
    fullPath: "/v1/promotion_codes/{promotion_code}"
  }),
  update: stripeMethod114({
    method: "POST",
    fullPath: "/v1/promotion_codes/{promotion_code}"
  }),
  list: stripeMethod114({
    method: "GET",
    fullPath: "/v1/promotion_codes",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Quotes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod115 = StripeResource.method;
var Quotes = StripeResource.extend({
  create: stripeMethod115({ method: "POST", fullPath: "/v1/quotes" }),
  retrieve: stripeMethod115({ method: "GET", fullPath: "/v1/quotes/{quote}" }),
  update: stripeMethod115({ method: "POST", fullPath: "/v1/quotes/{quote}" }),
  list: stripeMethod115({
    method: "GET",
    fullPath: "/v1/quotes",
    methodType: "list"
  }),
  accept: stripeMethod115({ method: "POST", fullPath: "/v1/quotes/{quote}/accept" }),
  cancel: stripeMethod115({ method: "POST", fullPath: "/v1/quotes/{quote}/cancel" }),
  finalizeQuote: stripeMethod115({
    method: "POST",
    fullPath: "/v1/quotes/{quote}/finalize"
  }),
  listComputedUpfrontLineItems: stripeMethod115({
    method: "GET",
    fullPath: "/v1/quotes/{quote}/computed_upfront_line_items",
    methodType: "list"
  }),
  listLineItems: stripeMethod115({
    method: "GET",
    fullPath: "/v1/quotes/{quote}/line_items",
    methodType: "list"
  }),
  pdf: stripeMethod115({
    method: "GET",
    fullPath: "/v1/quotes/{quote}/pdf",
    host: "files.stripe.com",
    streaming: true
  })
});

// node_modules/stripe/esm/resources/Refunds.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod116 = StripeResource.method;
var Refunds2 = StripeResource.extend({
  create: stripeMethod116({ method: "POST", fullPath: "/v1/refunds" }),
  retrieve: stripeMethod116({ method: "GET", fullPath: "/v1/refunds/{refund}" }),
  update: stripeMethod116({ method: "POST", fullPath: "/v1/refunds/{refund}" }),
  list: stripeMethod116({
    method: "GET",
    fullPath: "/v1/refunds",
    methodType: "list"
  }),
  cancel: stripeMethod116({
    method: "POST",
    fullPath: "/v1/refunds/{refund}/cancel"
  })
});

// node_modules/stripe/esm/resources/Reviews.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod117 = StripeResource.method;
var Reviews = StripeResource.extend({
  retrieve: stripeMethod117({ method: "GET", fullPath: "/v1/reviews/{review}" }),
  list: stripeMethod117({
    method: "GET",
    fullPath: "/v1/reviews",
    methodType: "list"
  }),
  approve: stripeMethod117({
    method: "POST",
    fullPath: "/v1/reviews/{review}/approve"
  })
});

// node_modules/stripe/esm/resources/SetupAttempts.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod118 = StripeResource.method;
var SetupAttempts = StripeResource.extend({
  list: stripeMethod118({
    method: "GET",
    fullPath: "/v1/setup_attempts",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/SetupIntents.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod119 = StripeResource.method;
var SetupIntents = StripeResource.extend({
  create: stripeMethod119({ method: "POST", fullPath: "/v1/setup_intents" }),
  retrieve: stripeMethod119({
    method: "GET",
    fullPath: "/v1/setup_intents/{intent}"
  }),
  update: stripeMethod119({
    method: "POST",
    fullPath: "/v1/setup_intents/{intent}"
  }),
  list: stripeMethod119({
    method: "GET",
    fullPath: "/v1/setup_intents",
    methodType: "list"
  }),
  cancel: stripeMethod119({
    method: "POST",
    fullPath: "/v1/setup_intents/{intent}/cancel"
  }),
  confirm: stripeMethod119({
    method: "POST",
    fullPath: "/v1/setup_intents/{intent}/confirm"
  }),
  verifyMicrodeposits: stripeMethod119({
    method: "POST",
    fullPath: "/v1/setup_intents/{intent}/verify_microdeposits"
  })
});

// node_modules/stripe/esm/resources/ShippingRates.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod120 = StripeResource.method;
var ShippingRates = StripeResource.extend({
  create: stripeMethod120({ method: "POST", fullPath: "/v1/shipping_rates" }),
  retrieve: stripeMethod120({
    method: "GET",
    fullPath: "/v1/shipping_rates/{shipping_rate_token}"
  }),
  update: stripeMethod120({
    method: "POST",
    fullPath: "/v1/shipping_rates/{shipping_rate_token}"
  }),
  list: stripeMethod120({
    method: "GET",
    fullPath: "/v1/shipping_rates",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Sources.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod121 = StripeResource.method;
var Sources = StripeResource.extend({
  create: stripeMethod121({ method: "POST", fullPath: "/v1/sources" }),
  retrieve: stripeMethod121({ method: "GET", fullPath: "/v1/sources/{source}" }),
  update: stripeMethod121({ method: "POST", fullPath: "/v1/sources/{source}" }),
  listSourceTransactions: stripeMethod121({
    method: "GET",
    fullPath: "/v1/sources/{source}/source_transactions",
    methodType: "list"
  }),
  verify: stripeMethod121({
    method: "POST",
    fullPath: "/v1/sources/{source}/verify"
  })
});

// node_modules/stripe/esm/resources/SubscriptionItems.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod122 = StripeResource.method;
var SubscriptionItems = StripeResource.extend({
  create: stripeMethod122({ method: "POST", fullPath: "/v1/subscription_items" }),
  retrieve: stripeMethod122({
    method: "GET",
    fullPath: "/v1/subscription_items/{item}"
  }),
  update: stripeMethod122({
    method: "POST",
    fullPath: "/v1/subscription_items/{item}"
  }),
  list: stripeMethod122({
    method: "GET",
    fullPath: "/v1/subscription_items",
    methodType: "list"
  }),
  del: stripeMethod122({
    method: "DELETE",
    fullPath: "/v1/subscription_items/{item}"
  })
});

// node_modules/stripe/esm/resources/SubscriptionSchedules.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod123 = StripeResource.method;
var SubscriptionSchedules = StripeResource.extend({
  create: stripeMethod123({
    method: "POST",
    fullPath: "/v1/subscription_schedules"
  }),
  retrieve: stripeMethod123({
    method: "GET",
    fullPath: "/v1/subscription_schedules/{schedule}"
  }),
  update: stripeMethod123({
    method: "POST",
    fullPath: "/v1/subscription_schedules/{schedule}"
  }),
  list: stripeMethod123({
    method: "GET",
    fullPath: "/v1/subscription_schedules",
    methodType: "list"
  }),
  cancel: stripeMethod123({
    method: "POST",
    fullPath: "/v1/subscription_schedules/{schedule}/cancel"
  }),
  release: stripeMethod123({
    method: "POST",
    fullPath: "/v1/subscription_schedules/{schedule}/release"
  })
});

// node_modules/stripe/esm/resources/Subscriptions.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod124 = StripeResource.method;
var Subscriptions = StripeResource.extend({
  create: stripeMethod124({ method: "POST", fullPath: "/v1/subscriptions" }),
  retrieve: stripeMethod124({
    method: "GET",
    fullPath: "/v1/subscriptions/{subscription_exposed_id}"
  }),
  update: stripeMethod124({
    method: "POST",
    fullPath: "/v1/subscriptions/{subscription_exposed_id}"
  }),
  list: stripeMethod124({
    method: "GET",
    fullPath: "/v1/subscriptions",
    methodType: "list"
  }),
  cancel: stripeMethod124({
    method: "DELETE",
    fullPath: "/v1/subscriptions/{subscription_exposed_id}"
  }),
  deleteDiscount: stripeMethod124({
    method: "DELETE",
    fullPath: "/v1/subscriptions/{subscription_exposed_id}/discount"
  }),
  migrate: stripeMethod124({
    method: "POST",
    fullPath: "/v1/subscriptions/{subscription}/migrate"
  }),
  resume: stripeMethod124({
    method: "POST",
    fullPath: "/v1/subscriptions/{subscription}/resume"
  }),
  search: stripeMethod124({
    method: "GET",
    fullPath: "/v1/subscriptions/search",
    methodType: "search"
  })
});

// node_modules/stripe/esm/resources/TaxCodes.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod125 = StripeResource.method;
var TaxCodes = StripeResource.extend({
  retrieve: stripeMethod125({ method: "GET", fullPath: "/v1/tax_codes/{id}" }),
  list: stripeMethod125({
    method: "GET",
    fullPath: "/v1/tax_codes",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/TaxIds.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod126 = StripeResource.method;
var TaxIds = StripeResource.extend({
  create: stripeMethod126({ method: "POST", fullPath: "/v1/tax_ids" }),
  retrieve: stripeMethod126({ method: "GET", fullPath: "/v1/tax_ids/{id}" }),
  list: stripeMethod126({
    method: "GET",
    fullPath: "/v1/tax_ids",
    methodType: "list"
  }),
  del: stripeMethod126({ method: "DELETE", fullPath: "/v1/tax_ids/{id}" })
});

// node_modules/stripe/esm/resources/TaxRates.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod127 = StripeResource.method;
var TaxRates = StripeResource.extend({
  create: stripeMethod127({ method: "POST", fullPath: "/v1/tax_rates" }),
  retrieve: stripeMethod127({ method: "GET", fullPath: "/v1/tax_rates/{tax_rate}" }),
  update: stripeMethod127({ method: "POST", fullPath: "/v1/tax_rates/{tax_rate}" }),
  list: stripeMethod127({
    method: "GET",
    fullPath: "/v1/tax_rates",
    methodType: "list"
  })
});

// node_modules/stripe/esm/resources/Tokens.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod128 = StripeResource.method;
var Tokens2 = StripeResource.extend({
  create: stripeMethod128({ method: "POST", fullPath: "/v1/tokens" }),
  retrieve: stripeMethod128({ method: "GET", fullPath: "/v1/tokens/{token}" })
});

// node_modules/stripe/esm/resources/Topups.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod129 = StripeResource.method;
var Topups = StripeResource.extend({
  create: stripeMethod129({ method: "POST", fullPath: "/v1/topups" }),
  retrieve: stripeMethod129({ method: "GET", fullPath: "/v1/topups/{topup}" }),
  update: stripeMethod129({ method: "POST", fullPath: "/v1/topups/{topup}" }),
  list: stripeMethod129({
    method: "GET",
    fullPath: "/v1/topups",
    methodType: "list"
  }),
  cancel: stripeMethod129({ method: "POST", fullPath: "/v1/topups/{topup}/cancel" })
});

// node_modules/stripe/esm/resources/Transfers.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod130 = StripeResource.method;
var Transfers = StripeResource.extend({
  create: stripeMethod130({ method: "POST", fullPath: "/v1/transfers" }),
  retrieve: stripeMethod130({ method: "GET", fullPath: "/v1/transfers/{transfer}" }),
  update: stripeMethod130({ method: "POST", fullPath: "/v1/transfers/{transfer}" }),
  list: stripeMethod130({
    method: "GET",
    fullPath: "/v1/transfers",
    methodType: "list"
  }),
  createReversal: stripeMethod130({
    method: "POST",
    fullPath: "/v1/transfers/{id}/reversals"
  }),
  listReversals: stripeMethod130({
    method: "GET",
    fullPath: "/v1/transfers/{id}/reversals",
    methodType: "list"
  }),
  retrieveReversal: stripeMethod130({
    method: "GET",
    fullPath: "/v1/transfers/{transfer}/reversals/{id}"
  }),
  updateReversal: stripeMethod130({
    method: "POST",
    fullPath: "/v1/transfers/{transfer}/reversals/{id}"
  })
});

// node_modules/stripe/esm/resources/WebhookEndpoints.js
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var stripeMethod131 = StripeResource.method;
var WebhookEndpoints = StripeResource.extend({
  create: stripeMethod131({ method: "POST", fullPath: "/v1/webhook_endpoints" }),
  retrieve: stripeMethod131({
    method: "GET",
    fullPath: "/v1/webhook_endpoints/{webhook_endpoint}"
  }),
  update: stripeMethod131({
    method: "POST",
    fullPath: "/v1/webhook_endpoints/{webhook_endpoint}"
  }),
  list: stripeMethod131({
    method: "GET",
    fullPath: "/v1/webhook_endpoints",
    methodType: "list"
  }),
  del: stripeMethod131({
    method: "DELETE",
    fullPath: "/v1/webhook_endpoints/{webhook_endpoint}"
  })
});

// node_modules/stripe/esm/resources.js
var Apps = resourceNamespace("apps", { Secrets });
var Billing = resourceNamespace("billing", {
  Alerts,
  CreditBalanceSummary,
  CreditBalanceTransactions,
  CreditGrants,
  MeterEventAdjustments,
  MeterEvents,
  Meters
});
var BillingPortal = resourceNamespace("billingPortal", {
  Configurations,
  Sessions
});
var Checkout = resourceNamespace("checkout", {
  Sessions: Sessions2
});
var Climate = resourceNamespace("climate", {
  Orders,
  Products,
  Suppliers
});
var Entitlements = resourceNamespace("entitlements", {
  ActiveEntitlements,
  Features
});
var FinancialConnections = resourceNamespace("financialConnections", {
  Accounts,
  Sessions: Sessions3,
  Transactions
});
var Forwarding = resourceNamespace("forwarding", {
  Requests
});
var Identity = resourceNamespace("identity", {
  VerificationReports,
  VerificationSessions
});
var Issuing = resourceNamespace("issuing", {
  Authorizations,
  Cardholders,
  Cards,
  Disputes,
  PersonalizationDesigns,
  PhysicalBundles,
  Tokens,
  Transactions: Transactions2
});
var Radar = resourceNamespace("radar", {
  EarlyFraudWarnings,
  ValueListItems,
  ValueLists
});
var Reporting = resourceNamespace("reporting", {
  ReportRuns,
  ReportTypes
});
var Sigma = resourceNamespace("sigma", {
  ScheduledQueryRuns
});
var Tax = resourceNamespace("tax", {
  Calculations,
  Registrations,
  Settings,
  Transactions: Transactions3
});
var Terminal = resourceNamespace("terminal", {
  Configurations: Configurations2,
  ConnectionTokens,
  Locations,
  Readers
});
var TestHelpers = resourceNamespace("testHelpers", {
  ConfirmationTokens,
  Customers,
  Refunds,
  TestClocks,
  Issuing: resourceNamespace("issuing", {
    Authorizations: Authorizations2,
    Cards: Cards2,
    PersonalizationDesigns: PersonalizationDesigns2,
    Transactions: Transactions4
  }),
  Terminal: resourceNamespace("terminal", {
    Readers: Readers2
  }),
  Treasury: resourceNamespace("treasury", {
    InboundTransfers,
    OutboundPayments,
    OutboundTransfers,
    ReceivedCredits,
    ReceivedDebits
  })
});
var Treasury = resourceNamespace("treasury", {
  CreditReversals,
  DebitReversals,
  FinancialAccounts,
  InboundTransfers: InboundTransfers2,
  OutboundPayments: OutboundPayments2,
  OutboundTransfers: OutboundTransfers2,
  ReceivedCredits: ReceivedCredits2,
  ReceivedDebits: ReceivedDebits2,
  TransactionEntries,
  Transactions: Transactions5
});
var V2 = resourceNamespace("v2", {
  Billing: resourceNamespace("billing", {
    MeterEventAdjustments: MeterEventAdjustments2,
    MeterEventSession,
    MeterEventStream,
    MeterEvents: MeterEvents2
  }),
  Core: resourceNamespace("core", {
    EventDestinations,
    Events
  })
});

// node_modules/stripe/esm/stripe.core.js
var DEFAULT_HOST = "api.stripe.com";
var DEFAULT_PORT = "443";
var DEFAULT_BASE_PATH = "/v1/";
var DEFAULT_API_VERSION = ApiVersion;
var DEFAULT_TIMEOUT = 8e4;
var MAX_NETWORK_RETRY_DELAY_SEC = 5;
var INITIAL_NETWORK_RETRY_DELAY_SEC = 0.5;
var APP_INFO_PROPERTIES = ["name", "version", "url", "partner_id"];
var ALLOWED_CONFIG_PROPERTIES = [
  "authenticator",
  "apiVersion",
  "typescript",
  "maxNetworkRetries",
  "httpAgent",
  "httpClient",
  "timeout",
  "host",
  "port",
  "protocol",
  "telemetry",
  "appInfo",
  "stripeAccount",
  "stripeContext"
];
var defaultRequestSenderFactory = /* @__PURE__ */ __name((stripe) => new RequestSender(stripe, StripeResource.MAX_BUFFERED_REQUEST_METRICS), "defaultRequestSenderFactory");
function createStripe(platformFunctions, requestSender = defaultRequestSenderFactory) {
  Stripe2.PACKAGE_VERSION = "19.3.1";
  Stripe2.API_VERSION = ApiVersion;
  Stripe2.USER_AGENT = Object.assign({ bindings_version: Stripe2.PACKAGE_VERSION, lang: "node", publisher: "stripe", uname: null, typescript: false }, determineProcessUserAgentProperties());
  Stripe2.StripeResource = StripeResource;
  Stripe2.StripeContext = StripeContext;
  Stripe2.resources = resources_exports;
  Stripe2.HttpClient = HttpClient;
  Stripe2.HttpClientResponse = HttpClientResponse;
  Stripe2.CryptoProvider = CryptoProvider;
  Stripe2.webhooks = createWebhooks(platformFunctions);
  function Stripe2(key, config2 = {}) {
    if (!(this instanceof Stripe2)) {
      return new Stripe2(key, config2);
    }
    const props = this._getPropsFromConfig(config2);
    this._platformFunctions = platformFunctions;
    Object.defineProperty(this, "_emitter", {
      value: this._platformFunctions.createEmitter(),
      enumerable: false,
      configurable: false,
      writable: false
    });
    this.VERSION = Stripe2.PACKAGE_VERSION;
    this.on = this._emitter.on.bind(this._emitter);
    this.once = this._emitter.once.bind(this._emitter);
    this.off = this._emitter.removeListener.bind(this._emitter);
    const agent = props.httpAgent || null;
    this._api = {
      host: props.host || DEFAULT_HOST,
      port: props.port || DEFAULT_PORT,
      protocol: props.protocol || "https",
      basePath: DEFAULT_BASE_PATH,
      version: props.apiVersion || DEFAULT_API_VERSION,
      timeout: validateInteger("timeout", props.timeout, DEFAULT_TIMEOUT),
      maxNetworkRetries: validateInteger("maxNetworkRetries", props.maxNetworkRetries, 2),
      agent,
      httpClient: props.httpClient || (agent ? this._platformFunctions.createNodeHttpClient(agent) : this._platformFunctions.createDefaultHttpClient()),
      dev: false,
      stripeAccount: props.stripeAccount || null,
      stripeContext: props.stripeContext || null
    };
    const typescript = props.typescript || false;
    if (typescript !== Stripe2.USER_AGENT.typescript) {
      Stripe2.USER_AGENT.typescript = typescript;
    }
    if (props.appInfo) {
      this._setAppInfo(props.appInfo);
    }
    this._prepResources();
    this._setAuthenticator(key, props.authenticator);
    this.errors = Error_exports;
    this.webhooks = Stripe2.webhooks;
    this._prevRequestMetrics = [];
    this._enableTelemetry = props.telemetry !== false;
    this._requestSender = requestSender(this);
    this.StripeResource = Stripe2.StripeResource;
  }
  __name(Stripe2, "Stripe");
  Stripe2.errors = Error_exports;
  Stripe2.createNodeHttpClient = platformFunctions.createNodeHttpClient;
  Stripe2.createFetchHttpClient = platformFunctions.createFetchHttpClient;
  Stripe2.createNodeCryptoProvider = platformFunctions.createNodeCryptoProvider;
  Stripe2.createSubtleCryptoProvider = platformFunctions.createSubtleCryptoProvider;
  Stripe2.prototype = {
    // Properties are set in the constructor above
    _appInfo: void 0,
    on: null,
    off: null,
    once: null,
    VERSION: null,
    StripeResource: null,
    webhooks: null,
    errors: null,
    _api: null,
    _prevRequestMetrics: null,
    _emitter: null,
    _enableTelemetry: null,
    _requestSender: null,
    _platformFunctions: null,
    rawRequest(method, path, params, options) {
      return this._requestSender._rawRequest(method, path, params, options);
    },
    /**
     * @private
     */
    _setAuthenticator(key, authenticator) {
      if (key && authenticator) {
        throw new Error("Can't specify both apiKey and authenticator");
      }
      if (!key && !authenticator) {
        throw new Error("Neither apiKey nor config.authenticator provided");
      }
      this._authenticator = key ? createApiKeyAuthenticator(key) : authenticator;
    },
    /**
     * @private
     * This may be removed in the future.
     */
    _setAppInfo(info3) {
      if (info3 && typeof info3 !== "object") {
        throw new Error("AppInfo must be an object.");
      }
      if (info3 && !info3.name) {
        throw new Error("AppInfo.name is required");
      }
      info3 = info3 || {};
      this._appInfo = APP_INFO_PROPERTIES.reduce((accum, prop) => {
        if (typeof info3[prop] == "string") {
          accum = accum || {};
          accum[prop] = info3[prop];
        }
        return accum;
      }, {});
    },
    /**
     * @private
     * This may be removed in the future.
     */
    _setApiField(key, value) {
      this._api[key] = value;
    },
    /**
     * @private
     * Please open or upvote an issue at github.com/stripe/stripe-node
     * if you use this, detailing your use-case.
     *
     * It may be deprecated and removed in the future.
     */
    getApiField(key) {
      return this._api[key];
    },
    setClientId(clientId) {
      this._clientId = clientId;
    },
    getClientId() {
      return this._clientId;
    },
    /**
     * @private
     * Please open or upvote an issue at github.com/stripe/stripe-node
     * if you use this, detailing your use-case.
     *
     * It may be deprecated and removed in the future.
     */
    getConstant: /* @__PURE__ */ __name((c) => {
      switch (c) {
        case "DEFAULT_HOST":
          return DEFAULT_HOST;
        case "DEFAULT_PORT":
          return DEFAULT_PORT;
        case "DEFAULT_BASE_PATH":
          return DEFAULT_BASE_PATH;
        case "DEFAULT_API_VERSION":
          return DEFAULT_API_VERSION;
        case "DEFAULT_TIMEOUT":
          return DEFAULT_TIMEOUT;
        case "MAX_NETWORK_RETRY_DELAY_SEC":
          return MAX_NETWORK_RETRY_DELAY_SEC;
        case "INITIAL_NETWORK_RETRY_DELAY_SEC":
          return INITIAL_NETWORK_RETRY_DELAY_SEC;
      }
      return Stripe2[c];
    }, "getConstant"),
    getMaxNetworkRetries() {
      return this.getApiField("maxNetworkRetries");
    },
    /**
     * @private
     * This may be removed in the future.
     */
    _setApiNumberField(prop, n, defaultVal) {
      const val = validateInteger(prop, n, defaultVal);
      this._setApiField(prop, val);
    },
    getMaxNetworkRetryDelay() {
      return MAX_NETWORK_RETRY_DELAY_SEC;
    },
    getInitialNetworkRetryDelay() {
      return INITIAL_NETWORK_RETRY_DELAY_SEC;
    },
    /**
     * @private
     * Please open or upvote an issue at github.com/stripe/stripe-node
     * if you use this, detailing your use-case.
     *
     * It may be deprecated and removed in the future.
     *
     * Gets a JSON version of a User-Agent and uses a cached version for a slight
     * speed advantage.
     */
    getClientUserAgent(cb) {
      return this.getClientUserAgentSeeded(Stripe2.USER_AGENT, cb);
    },
    /**
     * @private
     * Please open or upvote an issue at github.com/stripe/stripe-node
     * if you use this, detailing your use-case.
     *
     * It may be deprecated and removed in the future.
     *
     * Gets a JSON version of a User-Agent by encoding a seeded object and
     * fetching a uname from the system.
     */
    getClientUserAgentSeeded(seed, cb) {
      this._platformFunctions.getUname().then((uname) => {
        var _a;
        const userAgent = {};
        for (const field in seed) {
          if (!Object.prototype.hasOwnProperty.call(seed, field)) {
            continue;
          }
          userAgent[field] = encodeURIComponent((_a = seed[field]) !== null && _a !== void 0 ? _a : "null");
        }
        userAgent.uname = encodeURIComponent(uname || "UNKNOWN");
        const client = this.getApiField("httpClient");
        if (client) {
          userAgent.httplib = encodeURIComponent(client.getClientName());
        }
        if (this._appInfo) {
          userAgent.application = this._appInfo;
        }
        cb(JSON.stringify(userAgent));
      });
    },
    /**
     * @private
     * Please open or upvote an issue at github.com/stripe/stripe-node
     * if you use this, detailing your use-case.
     *
     * It may be deprecated and removed in the future.
     */
    getAppInfoAsString() {
      if (!this._appInfo) {
        return "";
      }
      let formatted = this._appInfo.name;
      if (this._appInfo.version) {
        formatted += `/${this._appInfo.version}`;
      }
      if (this._appInfo.url) {
        formatted += ` (${this._appInfo.url})`;
      }
      return formatted;
    },
    getTelemetryEnabled() {
      return this._enableTelemetry;
    },
    /**
     * @private
     * This may be removed in the future.
     */
    _prepResources() {
      for (const name in resources_exports) {
        if (!Object.prototype.hasOwnProperty.call(resources_exports, name)) {
          continue;
        }
        this[pascalToCamelCase(name)] = new resources_exports[name](this);
      }
    },
    /**
     * @private
     * This may be removed in the future.
     */
    _getPropsFromConfig(config2) {
      if (!config2) {
        return {};
      }
      const isString = typeof config2 === "string";
      const isObject2 = config2 === Object(config2) && !Array.isArray(config2);
      if (!isObject2 && !isString) {
        throw new Error("Config must either be an object or a string");
      }
      if (isString) {
        return {
          apiVersion: config2
        };
      }
      const values = Object.keys(config2).filter((value) => !ALLOWED_CONFIG_PROPERTIES.includes(value));
      if (values.length > 0) {
        throw new Error(`Config object may only contain the following: ${ALLOWED_CONFIG_PROPERTIES.join(", ")}`);
      }
      return config2;
    },
    parseEventNotification(payload, header, secret, tolerance, cryptoProvider, receivedAt) {
      const eventNotification = this.webhooks.constructEvent(payload, header, secret, tolerance, cryptoProvider, receivedAt);
      if (eventNotification.context) {
        eventNotification.context = StripeContext.parse(eventNotification.context);
      }
      eventNotification.fetchEvent = () => {
        return this._requestSender._rawRequest("GET", `/v2/core/events/${eventNotification.id}`, void 0, {
          stripeContext: eventNotification.context
        }, ["fetch_event"]);
      };
      eventNotification.fetchRelatedObject = () => {
        if (!eventNotification.related_object) {
          return Promise.resolve(null);
        }
        return this._requestSender._rawRequest("GET", eventNotification.related_object.url, void 0, {
          stripeContext: eventNotification.context
        }, ["fetch_related_object"]);
      };
      return eventNotification;
    }
  };
  return Stripe2;
}
__name(createStripe, "createStripe");

// node_modules/stripe/esm/stripe.esm.worker.js
var Stripe = createStripe(new WebPlatformFunctions());
var stripe_esm_worker_default = Stripe;

// src/worker/stripe-endpoints.ts
function getStripeClient(env2) {
  return new stripe_esm_worker_default(env2.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover"
  });
}
__name(getStripeClient, "getStripeClient");
async function getOrCreateStripeCustomer(stripe, db, mochaUserId, email, name) {
  const profile3 = await db.prepare(
    "SELECT stripe_customer_id FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUserId).first();
  if (profile3 && profile3.stripe_customer_id) {
    return profile3.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email,
    name: name || void 0,
    metadata: {
      mocha_user_id: mochaUserId
    }
  });
  await db.prepare(
    "UPDATE user_profiles SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
  ).bind(customer.id, mochaUserId).run();
  return customer.id;
}
__name(getOrCreateStripeCustomer, "getOrCreateStripeCustomer");
async function createPremiumCheckoutSession(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const stripe = getStripeClient(c.env);
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      c.env.DB,
      mochaUser.id,
      mochaUser.google_user_data.email,
      mochaUser.google_user_data.name
    );
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "MOMENTUM Premium",
              description: "Annual premium membership with exclusive perks"
            },
            unit_amount: 12e3,
            // $120.00
            recurring: {
              interval: "year"
            }
          },
          quantity: 1
        }
      ],
      success_url: `${c.req.header("origin") || ""}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${c.req.header("origin") || ""}/dashboard`,
      metadata: {
        mocha_user_id: mochaUser.id,
        plan_type: "premium"
      }
    });
    return c.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error3) {
    console.error("Error creating checkout session:", error3);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
}
__name(createPremiumCheckoutSession, "createPremiumCheckoutSession");
async function createAffiliateCheckoutSession(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const {
      event_name,
      event_date,
      ticket_price,
      quantity,
      referrer_user_id
    } = body;
    if (!event_name || !ticket_price || !quantity) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    const stripe = getStripeClient(c.env);
    const customerId = await getOrCreateStripeCustomer(
      stripe,
      c.env.DB,
      mochaUser.id,
      mochaUser.google_user_data.email,
      mochaUser.google_user_data.name
    );
    let commissionRate = 0.05;
    if (referrer_user_id) {
      const referrerProfile = await c.env.DB.prepare(
        "SELECT commission_rate FROM user_profiles WHERE mocha_user_id = ?"
      ).bind(referrer_user_id).first();
      if (referrerProfile && referrerProfile.commission_rate) {
        commissionRate = referrerProfile.commission_rate;
      }
    }
    const platformFeeAmount = Math.round(ticket_price * quantity * 0.05);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${event_name} - Tickets`,
              description: event_date ? `Event Date: ${event_date}` : void 0
            },
            unit_amount: ticket_price
          },
          quantity
        }
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        metadata: {
          mocha_user_id: mochaUser.id,
          event_name,
          event_date: event_date || "",
          ticket_quantity: quantity.toString(),
          referrer_user_id: referrer_user_id || "",
          commission_rate: commissionRate.toString()
        }
      },
      success_url: `${c.req.header("origin") || ""}/dashboard?purchase_success=true`,
      cancel_url: `${c.req.header("origin") || ""}/discover`,
      metadata: {
        mocha_user_id: mochaUser.id,
        type: "ticket_affiliate",
        event_name,
        referrer_user_id: referrer_user_id || ""
      }
    });
    return c.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error3) {
    console.error("Error creating affiliate checkout session:", error3);
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
}
__name(createAffiliateCheckoutSession, "createAffiliateCheckoutSession");
async function getSubscriptionStatus(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const subscription = await c.env.DB.prepare(
      `SELECT * FROM subscriptions 
       WHERE mocha_user_id = ? 
       AND status IN ('active', 'trialing')
       ORDER BY created_at DESC 
       LIMIT 1`
    ).bind(mochaUser.id).first();
    return c.json({
      subscription: subscription || null,
      isPremium: !!subscription
    });
  } catch (error3) {
    console.error("Error fetching subscription status:", error3);
    return c.json({ error: "Failed to fetch subscription status" }, 500);
  }
}
__name(getSubscriptionStatus, "getSubscriptionStatus");
async function cancelSubscription(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const subscription = await c.env.DB.prepare(
      `SELECT stripe_subscription_id FROM subscriptions 
       WHERE mocha_user_id = ? 
       AND status IN ('active', 'trialing')
       ORDER BY created_at DESC 
       LIMIT 1`
    ).bind(mochaUser.id).first();
    if (!subscription) {
      return c.json({ error: "No active subscription found" }, 404);
    }
    const stripe = getStripeClient(c.env);
    await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    );
    await c.env.DB.prepare(
      `UPDATE subscriptions 
       SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_subscription_id = ?`
    ).bind(subscription.stripe_subscription_id).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Error canceling subscription:", error3);
    return c.json({ error: "Failed to cancel subscription" }, 500);
  }
}
__name(cancelSubscription, "cancelSubscription");
async function getEarnings(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const profile3 = await c.env.DB.prepare(
      "SELECT earnings_balance, commission_rate FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    const affiliateSales = await c.env.DB.prepare(
      `SELECT * FROM affiliate_sales 
       WHERE referrer_user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`
    ).bind(mochaUser.id).all();
    const payoutRequests = await c.env.DB.prepare(
      `SELECT * FROM payout_requests 
       WHERE mocha_user_id = ? 
       ORDER BY requested_at DESC 
       LIMIT 20`
    ).bind(mochaUser.id).all();
    return c.json({
      earningsBalance: profile3?.earnings_balance || 0,
      commissionRate: profile3?.commission_rate || 0.05,
      affiliateSales: affiliateSales.results || [],
      payoutRequests: payoutRequests.results || []
    });
  } catch (error3) {
    console.error("Error fetching earnings:", error3);
    return c.json({ error: "Failed to fetch earnings" }, 500);
  }
}
__name(getEarnings, "getEarnings");
async function requestPayout(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const { amount } = body;
    if (!amount || amount <= 0) {
      return c.json({ error: "Invalid amount" }, 400);
    }
    const profile3 = await c.env.DB.prepare(
      "SELECT earnings_balance, stripe_account_id FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    if (!profile3) {
      return c.json({ error: "User profile not found" }, 404);
    }
    const earningsBalance = profile3.earnings_balance || 0;
    if (amount > earningsBalance) {
      return c.json({ error: "Insufficient balance" }, 400);
    }
    if (amount < 2e3) {
      return c.json({ error: "Minimum payout is $20" }, 400);
    }
    if (!profile3.stripe_account_id) {
      return c.json({ error: "Stripe account not connected" }, 400);
    }
    await c.env.DB.prepare(
      `INSERT INTO payout_requests (mocha_user_id, amount, stripe_account_id, requested_at, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(mochaUser.id, amount, profile3.stripe_account_id).run();
    await c.env.DB.prepare(
      `UPDATE user_profiles 
       SET earnings_balance = earnings_balance - ?, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    ).bind(amount, mochaUser.id).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Error requesting payout:", error3);
    return c.json({ error: "Failed to request payout" }, 500);
  }
}
__name(requestPayout, "requestPayout");
async function createConnectAccountLink(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const stripe = getStripeClient(c.env);
    const profile3 = await c.env.DB.prepare(
      "SELECT role, stripe_account_id FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    if (!profile3 || !["ambassador", "influencer"].includes(profile3.role)) {
      return c.json({ error: "Only ambassadors and influencers can connect accounts" }, 403);
    }
    let accountId = profile3.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: mochaUser.google_user_data.email,
        capabilities: {
          transfers: { requested: true }
        },
        metadata: {
          mocha_user_id: mochaUser.id
        }
      });
      accountId = account.id;
      await c.env.DB.prepare(
        `UPDATE user_profiles 
         SET stripe_account_id = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      ).bind(accountId, mochaUser.id).run();
    }
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${c.req.header("origin")}/dashboard`,
      return_url: `${c.req.header("origin")}/dashboard?stripe_connect=success`,
      type: "account_onboarding"
    });
    return c.json({
      url: accountLink.url
    });
  } catch (error3) {
    console.error("Error creating connect account link:", error3);
    return c.json({ error: "Failed to create connect account link" }, 500);
  }
}
__name(createConnectAccountLink, "createConnectAccountLink");
async function processPayout(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  try {
    const payoutId = c.req.param("payoutId");
    const body = await c.req.json();
    const { action, rejection_reason } = body;
    if (!action || !["approve", "reject"].includes(action)) {
      return c.json({ error: "Invalid action" }, 400);
    }
    const payout = await c.env.DB.prepare(
      "SELECT * FROM payout_requests WHERE id = ? AND status = 'pending'"
    ).bind(payoutId).first();
    if (!payout) {
      return c.json({ error: "Payout request not found or already processed" }, 404);
    }
    if (action === "approve") {
      const stripe = getStripeClient(c.env);
      const transfer = await stripe.transfers.create({
        amount: payout.amount,
        currency: payout.currency,
        destination: payout.stripe_account_id,
        metadata: {
          payout_request_id: payout.id.toString(),
          mocha_user_id: payout.mocha_user_id
        }
      });
      await c.env.DB.prepare(
        `UPDATE payout_requests 
         SET status = 'completed', 
             stripe_transfer_id = ?,
             processed_at = CURRENT_TIMESTAMP,
             processed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(transfer.id, mochaUser.id, payoutId).run();
      await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', 'Your payout of $' || ? || ' has been processed! \u{1F4B0}', CURRENT_TIMESTAMP)`
      ).bind(
        payout.mocha_user_id,
        (payout.amount / 100).toFixed(2)
      ).run();
    } else {
      await c.env.DB.prepare(
        `UPDATE user_profiles 
         SET earnings_balance = earnings_balance + ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      ).bind(payout.amount, payout.mocha_user_id).run();
      await c.env.DB.prepare(
        `UPDATE payout_requests 
         SET status = 'rejected',
             rejection_reason = ?,
             processed_at = CURRENT_TIMESTAMP,
             processed_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(rejection_reason || null, mochaUser.id, payoutId).run();
      await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', ?, CURRENT_TIMESTAMP)`
      ).bind(
        payout.mocha_user_id,
        rejection_reason ? `Your payout request was declined. Reason: ${rejection_reason}` : "Your payout request was declined."
      ).run();
    }
    return c.json({ success: true });
  } catch (error3) {
    console.error("Error processing payout:", error3);
    return c.json({ error: "Failed to process payout" }, 500);
  }
}
__name(processPayout, "processPayout");
async function getPendingPayouts(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  try {
    const payouts = await c.env.DB.prepare(
      `SELECT 
        payout_requests.*,
        user_profiles.display_name,
        user_profiles.role
      FROM payout_requests
      LEFT JOIN user_profiles ON payout_requests.mocha_user_id = user_profiles.mocha_user_id
      WHERE payout_requests.status = 'pending'
      ORDER BY payout_requests.requested_at ASC`
    ).all();
    return c.json({ payouts: payouts.results || [] });
  } catch (error3) {
    console.error("Error fetching pending payouts:", error3);
    return c.json({ error: "Failed to fetch pending payouts" }, 500);
  }
}
__name(getPendingPayouts, "getPendingPayouts");

// src/worker/stripe-webhooks.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function getStripeClient2(env2) {
  return new stripe_esm_worker_default(env2.STRIPE_SECRET_KEY, {
    apiVersion: "2025-10-29.clover"
  });
}
__name(getStripeClient2, "getStripeClient");
async function handleStripeWebhook(c) {
  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }
  try {
    const stripe = getStripeClient2(c.env);
    const body = await c.req.text();
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      c.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`Received webhook event: ${event.type}`);
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(c.env.DB, event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(c.env.DB, event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(c.env.DB, event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(c.env.DB, event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(c.env.DB, event.data.object);
        break;
      case "charge.succeeded":
        await handleChargeSucceeded(c.env.DB, event.data.object);
        break;
      case "transfer.created":
        await handleTransferCreated(c.env.DB, event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    return c.json({ received: true });
  } catch (error3) {
    console.error("Webhook error:", error3);
    return c.json({ error: "Webhook processing failed" }, 400);
  }
}
__name(handleStripeWebhook, "handleStripeWebhook");
async function handleCheckoutSessionCompleted(db, session) {
  console.log(`Checkout session completed: ${session.id}`);
  const mochaUserId = session.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in checkout session metadata");
    return;
  }
  if (session.mode === "subscription" && session.subscription) {
    console.log(`Creating subscription record for user ${mochaUserId}`);
    await db.prepare(
      `UPDATE user_profiles 
       SET is_premium = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    ).bind(mochaUserId).run();
    await db.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'payment', 'Welcome to MOMENTUM Premium! \u{1F451} Your subscription is now active.', CURRENT_TIMESTAMP)`
    ).bind(mochaUserId).run();
  }
  if (session.mode === "payment" && session.payment_intent) {
    console.log(`Processing affiliate ticket purchase for user ${mochaUserId}`);
  }
}
__name(handleCheckoutSessionCompleted, "handleCheckoutSessionCompleted");
async function handleSubscriptionUpdate(db, subscription) {
  console.log(`Subscription update: ${subscription.id}`);
  const mochaUserId = subscription.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in subscription metadata");
    return;
  }
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const currentPeriodStart = subscription.current_period_start ? new Date(subscription.current_period_start * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
  const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1e3).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString();
  await db.prepare(
    `INSERT INTO subscriptions (
      mocha_user_id, 
      stripe_customer_id, 
      stripe_subscription_id, 
      status, 
      plan_type,
      current_period_start, 
      current_period_end,
      cancel_at_period_end,
      created_at, 
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = CURRENT_TIMESTAMP`
  ).bind(
    mochaUserId,
    customerId,
    subscription.id,
    subscription.status,
    "premium",
    currentPeriodStart,
    currentPeriodEnd,
    subscription.cancel_at_period_end ? 1 : 0
  ).run();
  const isPremium = ["active", "trialing"].includes(subscription.status) ? 1 : 0;
  await db.prepare(
    `UPDATE user_profiles 
     SET is_premium = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE mocha_user_id = ?`
  ).bind(isPremium, mochaUserId).run();
}
__name(handleSubscriptionUpdate, "handleSubscriptionUpdate");
async function handleSubscriptionDeleted(db, subscription) {
  console.log(`Subscription deleted: ${subscription.id}`);
  await db.prepare(
    `UPDATE subscriptions 
     SET status = 'canceled', updated_at = CURRENT_TIMESTAMP 
     WHERE stripe_subscription_id = ?`
  ).bind(subscription.id).run();
  const subRecord = await db.prepare(
    "SELECT mocha_user_id FROM subscriptions WHERE stripe_subscription_id = ?"
  ).bind(subscription.id).first();
  if (subRecord) {
    await db.prepare(
      `UPDATE user_profiles 
       SET is_premium = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    ).bind(subRecord.mocha_user_id).run();
    await db.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'payment', 'Your MOMENTUM Premium subscription has ended.', CURRENT_TIMESTAMP)`
    ).bind(subRecord.mocha_user_id).run();
  }
}
__name(handleSubscriptionDeleted, "handleSubscriptionDeleted");
async function handlePaymentIntentSucceeded(db, paymentIntent) {
  console.log(`Payment intent succeeded: ${paymentIntent.id}`);
  const mochaUserId = paymentIntent.metadata?.mocha_user_id;
  if (!mochaUserId) {
    console.error("No mocha_user_id in payment intent metadata");
    return;
  }
  const transactionType = paymentIntent.metadata?.type || "ticket_purchase";
  await db.prepare(
    `INSERT INTO transactions (
      mocha_user_id,
      type,
      amount,
      currency,
      stripe_payment_intent_id,
      status,
      description,
      metadata,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'succeeded', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    mochaUserId,
    transactionType,
    paymentIntent.amount,
    paymentIntent.currency,
    paymentIntent.id,
    paymentIntent.description || null,
    JSON.stringify(paymentIntent.metadata)
  ).run();
  const transaction = await db.prepare(
    "SELECT id FROM transactions WHERE stripe_payment_intent_id = ?"
  ).bind(paymentIntent.id).first();
  if (transactionType === "ticket_affiliate" && transaction) {
    const referrerUserId = paymentIntent.metadata?.referrer_user_id;
    const commissionRateStr = paymentIntent.metadata?.commission_rate;
    if (referrerUserId && commissionRateStr) {
      const commissionRate = parseFloat(commissionRateStr);
      const commissionAmount = Math.round(paymentIntent.amount * commissionRate);
      await db.prepare(
        `INSERT INTO affiliate_sales (
          referrer_user_id,
          transaction_id,
          commission_amount,
          commission_rate,
          event_name,
          event_date,
          ticket_quantity,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        referrerUserId,
        transaction.id,
        commissionAmount,
        commissionRate,
        paymentIntent.metadata?.event_name || null,
        paymentIntent.metadata?.event_date || null,
        paymentIntent.metadata?.ticket_quantity ? parseInt(paymentIntent.metadata.ticket_quantity) : null
      ).run();
      await db.prepare(
        `UPDATE user_profiles 
         SET earnings_balance = earnings_balance + ?, updated_at = CURRENT_TIMESTAMP 
         WHERE mocha_user_id = ?`
      ).bind(commissionAmount, referrerUserId).run();
      await db.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, created_at)
         VALUES (?, 'payment', 'You earned $' || ? || ' in commission! \u{1F4B0}', CURRENT_TIMESTAMP)`
      ).bind(
        referrerUserId,
        (commissionAmount / 100).toFixed(2)
      ).run();
    }
  }
  await db.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, created_at)
     VALUES (?, 'payment', 'Payment successful! Your order is confirmed. \u2705', CURRENT_TIMESTAMP)`
  ).bind(mochaUserId).run();
}
__name(handlePaymentIntentSucceeded, "handlePaymentIntentSucceeded");
async function handlePaymentIntentFailed(db, paymentIntent) {
  console.log(`Payment intent failed: ${paymentIntent.id}`);
  const mochaUserId = paymentIntent.metadata?.mocha_user_id;
  if (!mochaUserId) {
    return;
  }
  await db.prepare(
    `INSERT INTO transactions (
      mocha_user_id,
      type,
      amount,
      currency,
      stripe_payment_intent_id,
      status,
      description,
      metadata,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'failed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    mochaUserId,
    paymentIntent.metadata?.type || "ticket_purchase",
    paymentIntent.amount,
    paymentIntent.currency,
    paymentIntent.id,
    paymentIntent.description || null,
    JSON.stringify(paymentIntent.metadata)
  ).run();
  await db.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, created_at)
     VALUES (?, 'payment', 'Payment failed. Please check your payment method and try again.', CURRENT_TIMESTAMP)`
  ).bind(mochaUserId).run();
}
__name(handlePaymentIntentFailed, "handlePaymentIntentFailed");
async function handleChargeSucceeded(db, charge) {
  console.log(`Charge succeeded: ${charge.id}`);
  if (charge.payment_intent) {
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
    await db.prepare(
      `UPDATE transactions 
       SET stripe_charge_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE stripe_payment_intent_id = ?`
    ).bind(charge.id, paymentIntentId).run();
  }
}
__name(handleChargeSucceeded, "handleChargeSucceeded");
async function handleTransferCreated(db, transfer) {
  console.log(`Transfer created: ${transfer.id}`);
  const payoutRequestId = transfer.metadata?.payout_request_id;
  if (payoutRequestId) {
    await db.prepare(
      `UPDATE payout_requests 
       SET stripe_transfer_id = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(transfer.id, payoutRequestId).run();
  }
}
__name(handleTransferCreated, "handleTransferCreated");

// src/worker/stream-service.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var StreamService = class {
  static {
    __name(this, "StreamService");
  }
  accountId;
  apiToken;
  constructor(accountId, apiToken) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }
  /**
   * Upload a video file to Cloudflare Stream
   */
  async uploadVideo(file, metadata) {
    const formData = new FormData();
    formData.append("file", file);
    if (metadata?.name) {
      formData.append("meta", JSON.stringify({ name: metadata.name }));
    }
    formData.append("requireSignedURLs", "false");
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        },
        body: formData
      }
    );
    if (!response.ok) {
      const error3 = await response.text();
      throw new Error(`Stream upload failed: ${error3}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(`Stream upload failed: ${JSON.stringify(data.errors)}`);
    }
    return this.formatVideoDetails(data.result);
  }
  /**
   * Upload a video from a URL to Cloudflare Stream
   */
  async uploadFromUrl(url, metadata) {
    const requestBody = {
      url,
      meta: metadata?.name ? { name: metadata.name } : {},
      requireSignedURLs: false
    };
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/copy`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      }
    );
    if (!response.ok) {
      const error3 = await response.text();
      throw new Error(`Stream URL upload failed: ${error3}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(`Stream URL upload failed: ${JSON.stringify(data.errors)}`);
    }
    return this.formatVideoDetails(data.result);
  }
  /**
   * Get video details and status from Stream
   */
  async getVideoDetails(videoId) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}`,
      {
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        }
      }
    );
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error3 = await response.text();
      throw new Error(`Failed to get video details: ${error3}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(`Failed to get video details: ${JSON.stringify(data.errors)}`);
    }
    return this.formatVideoDetails(data.result);
  }
  /**
   * Delete a video from Stream
   */
  async deleteVideo(videoId) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${this.apiToken}`
        }
      }
    );
    if (!response.ok) {
      const error3 = await response.text();
      throw new Error(`Failed to delete video: ${error3}`);
    }
    const data = await response.json();
    return data.success;
  }
  /**
   * Generate a thumbnail URL for a specific timestamp
   */
  getThumbnailUrl(videoId, options) {
    const params = new URLSearchParams();
    if (options?.time) params.append("time", options.time);
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());
    const queryString = params.toString();
    const baseUrl = `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`;
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
  /**
   * Get the embed iframe URL for a video
   */
  getEmbedUrl(videoId) {
    return `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/iframe`;
  }
  /**
   * Get direct playback URL
   */
  getPlaybackUrl(videoId) {
    return `https://customer-${this.accountId.substring(0, 8)}.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
  }
  /**
   * Format raw Stream API response into our internal format
   */
  formatVideoDetails(rawData) {
    return {
      uid: rawData.uid,
      thumbnail: rawData.thumbnail || this.getThumbnailUrl(rawData.uid),
      playbackUrl: rawData.playback?.hls || this.getPlaybackUrl(rawData.uid),
      hlsUrl: rawData.playback?.hls || this.getPlaybackUrl(rawData.uid),
      dashUrl: rawData.playback?.dash || "",
      previewUrl: rawData.preview || "",
      readyToStream: rawData.ready_to_stream || false,
      duration: rawData.duration || 0,
      status: rawData.status?.state || "processing"
    };
  }
};
function createStreamService(env2) {
  if (!env2.CLOUDFLARE_ACCOUNT_ID || !env2.CLOUDFLARE_STREAM_API_TOKEN) {
    throw new Error("Cloudflare Stream credentials not configured");
  }
  return new StreamService(env2.CLOUDFLARE_ACCOUNT_ID, env2.CLOUDFLARE_STREAM_API_TOKEN);
}
__name(createStreamService, "createStreamService");

// src/worker/stream-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function uploadFromUrl(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { video_url, name } = body;
  if (!video_url) {
    return c.json({ error: "video_url is required" }, 400);
  }
  try {
    const streamService = createStreamService(c.env);
    const videoDetails = await streamService.uploadFromUrl(video_url, {
      name: name || "Uploaded video"
    });
    return c.json({
      success: true,
      streamVideoId: videoDetails.uid,
      playbackUrl: videoDetails.playbackUrl,
      thumbnailUrl: videoDetails.thumbnail,
      status: videoDetails.status,
      readyToStream: videoDetails.readyToStream,
      duration: videoDetails.duration
    }, 201);
  } catch (error3) {
    console.error("Stream upload from URL failed:", error3);
    return c.json({
      error: error3 instanceof Error ? error3.message : "Failed to upload video to Stream"
    }, 500);
  }
}
__name(uploadFromUrl, "uploadFromUrl");
async function getVideoStatus(c) {
  const videoId = c.req.param("videoId");
  try {
    const streamService = createStreamService(c.env);
    const videoDetails = await streamService.getVideoDetails(videoId);
    if (!videoDetails) {
      return c.json({ error: "Video not found" }, 404);
    }
    return c.json({
      streamVideoId: videoDetails.uid,
      playbackUrl: videoDetails.playbackUrl,
      thumbnailUrl: videoDetails.thumbnail,
      status: videoDetails.status,
      readyToStream: videoDetails.readyToStream,
      duration: videoDetails.duration
    });
  } catch (error3) {
    console.error("Failed to get video status:", error3);
    return c.json({
      error: error3 instanceof Error ? error3.message : "Failed to get video status"
    }, 500);
  }
}
__name(getVideoStatus, "getVideoStatus");
async function deleteVideo(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const videoId = c.req.param("videoId");
  try {
    const streamService = createStreamService(c.env);
    const success = await streamService.deleteVideo(videoId);
    if (success) {
      return c.json({ success: true });
    } else {
      return c.json({ error: "Failed to delete video" }, 500);
    }
  } catch (error3) {
    console.error("Failed to delete video:", error3);
    return c.json({
      error: error3 instanceof Error ? error3.message : "Failed to delete video"
    }, 500);
  }
}
__name(deleteVideo, "deleteVideo");
async function getThumbnail(c) {
  const videoId = c.req.param("videoId");
  const time3 = c.req.query("time") || "0s";
  const width = parseInt(c.req.query("width") || "0");
  const height = parseInt(c.req.query("height") || "0");
  try {
    const streamService = createStreamService(c.env);
    const thumbnailUrl = streamService.getThumbnailUrl(videoId, {
      time: time3,
      width: width > 0 ? width : void 0,
      height: height > 0 ? height : void 0
    });
    return c.json({ thumbnailUrl });
  } catch (error3) {
    console.error("Failed to get thumbnail URL:", error3);
    return c.json({
      error: error3 instanceof Error ? error3.message : "Failed to get thumbnail URL"
    }, 500);
  }
}
__name(getThumbnail, "getThumbnail");

// src/worker/realtime-service.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function createRealtimeService(env2) {
  const getStub = /* @__PURE__ */ __name(() => {
    const id = env2.REALTIME.idFromName("global");
    return env2.REALTIME.get(id);
  }, "getStub");
  const broadcast = /* @__PURE__ */ __name(async (type, data, channel2 = "global") => {
    try {
      const stub = getStub();
      await stub.fetch("https://realtime/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, channel: channel2 })
      });
    } catch (error3) {
      console.error("Failed to broadcast:", error3);
    }
  }, "broadcast");
  return {
    async broadcastFeedUpdate(clipId) {
      await broadcast("feed_update", { clipId }, "feed");
    },
    async broadcastNotification(userId, notification) {
      await broadcast("notification", notification, `user:${userId}`);
    },
    async broadcastChatMessage(sessionId, message) {
      await broadcast("chat_message", message, `live:${sessionId}`);
    },
    async broadcastLeaderboardUpdate(data) {
      await broadcast("leaderboard_update", data, "leaderboard");
    },
    async broadcastCommissionUpdate(userId, data) {
      await broadcast("commission_update", data, `user:${userId}`);
    }
  };
}
__name(createRealtimeService, "createRealtimeService");

// src/worker/two-factor-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import * as crypto3 from "crypto";
async function setupTwoFactor(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const profile3 = await c.env.DB.prepare(
    "SELECT role, is_verified FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!profile3 || !profile3.is_verified) {
    return c.json({ error: "2FA is only available for verified users" }, 403);
  }
  const existing2FA = await c.env.DB.prepare(
    "SELECT is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (existing2FA && existing2FA.is_enabled) {
    return c.json({ error: "2FA is already enabled" }, 400);
  }
  const secret = generateBase32Secret();
  const backupCodes = generateBackupCodes(8);
  if (existing2FA) {
    await c.env.DB.prepare(
      `UPDATE two_factor_auth 
       SET secret = ?, backup_codes = ?, is_enabled = 0, updated_at = CURRENT_TIMESTAMP 
       WHERE mocha_user_id = ?`
    ).bind(secret, JSON.stringify(backupCodes), mochaUser.id).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO two_factor_auth (mocha_user_id, secret, backup_codes, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(mochaUser.id, secret, JSON.stringify(backupCodes)).run();
  }
  const appName = "MOMENTUM";
  const userLabel = mochaUser.google_user_data.email;
  const otpAuthUrl = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(userLabel)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;
  return c.json({
    secret,
    qrCodeUrl: otpAuthUrl,
    backupCodes
  });
}
__name(setupTwoFactor, "setupTwoFactor");
async function verifyAndEnableTwoFactor(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { code } = body;
  if (!code) {
    return c.json({ error: "Verification code required" }, 400);
  }
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!twoFactorAuth) {
    return c.json({ error: "2FA not set up" }, 404);
  }
  if (twoFactorAuth.is_enabled) {
    return c.json({ error: "2FA already enabled" }, 400);
  }
  const isValid = verifyTOTP(twoFactorAuth.secret, code);
  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }
  await c.env.DB.prepare(
    "UPDATE two_factor_auth SET is_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).run();
  return c.json({ success: true, message: "2FA enabled successfully" });
}
__name(verifyAndEnableTwoFactor, "verifyAndEnableTwoFactor");
async function disableTwoFactor(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { code, backupCode } = body;
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, backup_codes, is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!twoFactorAuth || !twoFactorAuth.is_enabled) {
    return c.json({ error: "2FA not enabled" }, 400);
  }
  let isValid = false;
  if (code) {
    isValid = verifyTOTP(twoFactorAuth.secret, code);
  } else if (backupCode) {
    const backupCodes = JSON.parse(twoFactorAuth.backup_codes);
    const index = backupCodes.indexOf(backupCode);
    if (index !== -1) {
      isValid = true;
      backupCodes.splice(index, 1);
      await c.env.DB.prepare(
        "UPDATE two_factor_auth SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
      ).bind(JSON.stringify(backupCodes), mochaUser.id).run();
    }
  }
  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }
  await c.env.DB.prepare(
    "DELETE FROM two_factor_auth WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).run();
  return c.json({ success: true, message: "2FA disabled successfully" });
}
__name(disableTwoFactor, "disableTwoFactor");
async function getTwoFactorStatus(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT is_enabled FROM two_factor_auth WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  return c.json({
    enabled: twoFactorAuth?.is_enabled === 1
  });
}
__name(getTwoFactorStatus, "getTwoFactorStatus");
async function verifyTwoFactorLogin(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { code, backupCode } = body;
  const twoFactorAuth = await c.env.DB.prepare(
    "SELECT secret, backup_codes FROM two_factor_auth WHERE mocha_user_id = ? AND is_enabled = 1"
  ).bind(mochaUser.id).first();
  if (!twoFactorAuth) {
    return c.json({ error: "2FA not enabled" }, 400);
  }
  let isValid = false;
  if (code) {
    isValid = verifyTOTP(twoFactorAuth.secret, code);
  } else if (backupCode) {
    const backupCodes = JSON.parse(twoFactorAuth.backup_codes);
    const index = backupCodes.indexOf(backupCode);
    if (index !== -1) {
      isValid = true;
      backupCodes.splice(index, 1);
      await c.env.DB.prepare(
        "UPDATE two_factor_auth SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
      ).bind(JSON.stringify(backupCodes), mochaUser.id).run();
    }
  }
  if (!isValid) {
    return c.json({ error: "Invalid verification code" }, 400);
  }
  return c.json({ success: true, verified: true });
}
__name(verifyTwoFactorLogin, "verifyTwoFactorLogin");
function generateBase32Secret(length = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  const bytes = crypto3.randomBytes(length);
  for (let i = 0; i < length; i++) {
    secret += chars[bytes[i] % chars.length];
  }
  return secret;
}
__name(generateBase32Secret, "generateBase32Secret");
function generateBackupCodes(count3 = 8) {
  const codes = [];
  for (let i = 0; i < count3; i++) {
    const bytes = crypto3.randomBytes(4);
    const code = bytes.toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }
  return codes;
}
__name(generateBackupCodes, "generateBackupCodes");
function verifyTOTP(secret, token) {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1e3);
  const timeCounter = Math.floor(currentTime / timeStep);
  for (let i = -1; i <= 1; i++) {
    const counter = timeCounter + i;
    const generatedToken = generateTOTP(secret, counter);
    if (generatedToken === token) {
      return true;
    }
  }
  return false;
}
__name(verifyTOTP, "verifyTOTP");
function generateTOTP(secret, counter) {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto3.createHmac("sha1", key);
  hmac.update(buffer);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 15;
  const binary = (hash[offset] & 127) << 24 | (hash[offset + 1] & 255) << 16 | (hash[offset + 2] & 255) << 8 | hash[offset + 3] & 255;
  const otp = binary % 1e6;
  return otp.toString().padStart(6, "0");
}
__name(generateTOTP, "generateTOTP");
function base32Decode(encoded) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [];
  for (const char of encoded.toUpperCase()) {
    const val = chars.indexOf(char);
    if (val === -1) continue;
    for (let i = 4; i >= 0; i--) {
      bits.push(val >> i & 1);
    }
  }
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 <= bits.length) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = byte << 1 | bits[i + j];
      }
      bytes.push(byte);
    }
  }
  return Buffer.from(bytes);
}
__name(base32Decode, "base32Decode");

// src/worker/analytics-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function trackDailyActiveUser(db, userId) {
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  await db.prepare(
    `INSERT OR IGNORE INTO daily_active_users (mocha_user_id, activity_date, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  ).bind(userId, today).run();
}
__name(trackDailyActiveUser, "trackDailyActiveUser");
async function getPlatformAnalytics(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const range = c.req.query("range") || "30d";
  let daysBack = 30;
  switch (range) {
    case "7d":
      daysBack = 7;
      break;
    case "90d":
      daysBack = 90;
      break;
    default:
      daysBack = 30;
  }
  const totalUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM user_profiles"
  ).first();
  const totalClips = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clips WHERE is_hidden = 0"
  ).first();
  const totalViewsLikes = await c.env.DB.prepare(
    "SELECT SUM(views_count) as views, SUM(likes_count) as likes FROM clips WHERE is_hidden = 0"
  ).first();
  const activeSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions WHERE status = 'live'"
  ).first();
  const totalSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions"
  ).first();
  const dailyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date = date('now')"
  ).first();
  const weeklyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date >= date('now', '-7 days')"
  ).first();
  const monthlyActiveUsers = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT mocha_user_id) as count FROM daily_active_users WHERE activity_date >= date('now', '-30 days')"
  ).first();
  const uploadsPerDay = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      COUNT(*) as uploads
    FROM clips
    WHERE created_at >= date('now', '-' || ? || ' days')
    AND is_hidden = 0
    GROUP BY date(created_at)
    ORDER BY date DESC`
  ).bind(daysBack).all();
  const engagementMetrics = await c.env.DB.prepare(
    `SELECT 
      SUM(likes_count) as total_likes,
      SUM(comments_count) as total_comments,
      SUM(views_count) as total_views,
      COUNT(*) as total_clips,
      AVG(likes_count) as avg_likes_per_clip,
      AVG(comments_count) as avg_comments_per_clip,
      AVG(views_count) as avg_views_per_clip
    FROM clips
    WHERE created_at >= date('now', '-' || ? || ' days')
    AND is_hidden = 0`
  ).bind(daysBack).first();
  const growthData = await c.env.DB.prepare(
    `WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-' || ? || ' days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    )
    SELECT 
      dates.date,
      COALESCE(COUNT(DISTINCT user_profiles.id), 0) as users,
      COALESCE(COUNT(DISTINCT clips.id), 0) as clips,
      COALESCE(SUM(clips.views_count), 0) as views,
      COALESCE(COUNT(DISTINCT dau.mocha_user_id), 0) as active_users
    FROM dates
    LEFT JOIN user_profiles ON date(user_profiles.created_at) = dates.date
    LEFT JOIN clips ON date(clips.created_at) = dates.date AND clips.is_hidden = 0
    LEFT JOIN daily_active_users dau ON dau.activity_date = dates.date
    GROUP BY dates.date
    ORDER BY dates.date ASC`
  ).bind(daysBack).all();
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score,
      ROUND(CAST(clips.likes_count + clips.comments_count AS REAL) / NULLIF(clips.views_count, 0) * 100, 2) as engagement_rate
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 10`
  ).bind(daysBack).all();
  const topUsers = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(clips.id) as total_clips,
      SUM(clips.likes_count) as total_likes,
      SUM(clips.views_count) as total_views,
      SUM(clips.comments_count) as total_comments
    FROM user_profiles
    JOIN clips ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY user_profiles.mocha_user_id
    ORDER BY total_clips DESC, total_likes DESC
    LIMIT 10`
  ).bind(daysBack).all();
  return c.json({
    platformStats: {
      totalUsers: totalUsers?.count || 0,
      totalClips: totalClips?.count || 0,
      totalViews: totalViewsLikes?.views || 0,
      totalLikes: totalViewsLikes?.likes || 0,
      activeSessions: activeSessions?.count || 0,
      totalSessions: totalSessions?.count || 0,
      dailyActiveUsers: dailyActiveUsers?.count || 0,
      weeklyActiveUsers: weeklyActiveUsers?.count || 0,
      monthlyActiveUsers: monthlyActiveUsers?.count || 0
    },
    uploadsPerDay: uploadsPerDay.results || [],
    engagementMetrics: engagementMetrics || {},
    growthData: growthData.results || [],
    topClips: topClips.results || [],
    topUsers: topUsers.results || []
  });
}
__name(getPlatformAnalytics, "getPlatformAnalytics");
async function getUserAnalytics(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await trackDailyActiveUser(c.env.DB, mochaUser.id);
  const userId = c.req.query("user_id") || mochaUser.id;
  if (userId !== mochaUser.id) {
    const userProfile = await c.env.DB.prepare(
      "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    if (!userProfile || !userProfile.is_admin) {
      return c.json({ error: "Access denied" }, 403);
    }
  }
  const followerCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE following_id = ?"
  ).bind(userId).first();
  const followingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?"
  ).bind(userId).first();
  const profileViews = await c.env.DB.prepare(
    `SELECT COUNT(*) as count 
     FROM profile_views 
     WHERE profile_user_id = ? 
     AND created_at >= date('now', '-30 days')`
  ).bind(userId).first();
  const clipStats = await c.env.DB.prepare(
    `SELECT 
      COUNT(*) as total_clips,
      SUM(likes_count) as total_likes,
      SUM(views_count) as total_views,
      SUM(comments_count) as total_comments,
      AVG(likes_count) as avg_likes,
      AVG(views_count) as avg_views,
      AVG(comments_count) as avg_comments
    FROM clips
    WHERE mocha_user_id = ?
    AND is_hidden = 0`
  ).bind(userId).first();
  const savedClipsCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM saved_clips WHERE mocha_user_id = ?"
  ).bind(userId).first();
  const engagementOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      SUM(likes_count) as likes,
      SUM(views_count) as views,
      SUM(comments_count) as comments
    FROM clips
    WHERE mocha_user_id = ?
    AND created_at >= date('now', '-30 days')
    AND is_hidden = 0
    GROUP BY date(created_at)
    ORDER BY date ASC`
  ).bind(userId).all();
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score
    FROM clips
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 5`
  ).bind(userId).all();
  return c.json({
    followers: followerCount?.count || 0,
    following: followingCount?.count || 0,
    profileViews: profileViews?.count || 0,
    savedClips: savedClipsCount?.count || 0,
    clipStats: clipStats || {},
    engagementOverTime: engagementOverTime.results || [],
    topClips: topClips.results || []
  });
}
__name(getUserAnalytics, "getUserAnalytics");
async function getAmbassadorAnalytics(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role, commission_rate, earnings_balance FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "ambassador") {
    return c.json({ error: "Ambassador access required" }, 403);
  }
  const totalEarnings = await c.env.DB.prepare(
    "SELECT SUM(commission_amount) as total FROM affiliate_sales WHERE referrer_user_id = ?"
  ).bind(mochaUser.id).first();
  const monthlyEarnings = await c.env.DB.prepare(
    `SELECT SUM(commission_amount) as total 
     FROM affiliate_sales 
     WHERE referrer_user_id = ? 
     AND created_at >= date('now', '-30 days')`
  ).bind(mochaUser.id).first();
  const earningsOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      SUM(commission_amount) as earnings,
      COUNT(*) as sales
    FROM affiliate_sales
    WHERE referrer_user_id = ?
    AND created_at >= date('now', '-90 days')
    GROUP BY date(created_at)
    ORDER BY date ASC`
  ).bind(mochaUser.id).all();
  const topPerformingClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      COUNT(affiliate_sales.id) as total_sales,
      SUM(affiliate_sales.commission_amount) as total_commission
    FROM clips
    LEFT JOIN affiliate_sales ON affiliate_sales.referrer_user_id = clips.mocha_user_id
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0
    GROUP BY clips.id
    ORDER BY total_sales DESC, total_commission DESC
    LIMIT 10`
  ).bind(mochaUser.id).all();
  const conversionStats = await c.env.DB.prepare(
    `SELECT 
      COUNT(DISTINCT clips.id) as total_clips,
      COUNT(DISTINCT affiliate_sales.id) as total_conversions,
      ROUND(CAST(COUNT(DISTINCT affiliate_sales.id) AS REAL) / NULLIF(COUNT(DISTINCT clips.id), 0) * 100, 2) as conversion_rate
    FROM clips
    LEFT JOIN affiliate_sales ON affiliate_sales.referrer_user_id = clips.mocha_user_id
    WHERE clips.mocha_user_id = ?
    AND clips.is_hidden = 0`
  ).bind(mochaUser.id).first();
  const recentSales = await c.env.DB.prepare(
    `SELECT * FROM affiliate_sales 
     WHERE referrer_user_id = ? 
     ORDER BY created_at DESC 
     LIMIT 20`
  ).bind(mochaUser.id).all();
  return c.json({
    totalEarnings: (totalEarnings?.total || 0) / 100,
    // Convert to dollars
    monthlyEarnings: (monthlyEarnings?.total || 0) / 100,
    earningsBalance: (userProfile.earnings_balance || 0) / 100,
    commissionRate: userProfile.commission_rate || 0.05,
    earningsOverTime: earningsOverTime.results || [],
    topPerformingClips: topPerformingClips.results || [],
    conversionStats: conversionStats || {},
    recentSales: recentSales.results || []
  });
}
__name(getAmbassadorAnalytics, "getAmbassadorAnalytics");
async function getTrendAnalysis(c) {
  const range = c.req.query("range") || "week";
  let daysBack = 7;
  switch (range) {
    case "day":
      daysBack = 1;
      break;
    case "week":
      daysBack = 7;
      break;
    case "month":
      daysBack = 30;
      break;
    default:
      daysBack = 7;
  }
  const topArtists = await c.env.DB.prepare(
    `SELECT 
      clips.artist_name,
      artists.image_url,
      COUNT(DISTINCT clips.id) as clip_count,
      SUM(clips.views_count) as total_views,
      SUM(clips.likes_count) as total_likes,
      (SUM(clips.likes_count) * 3 + SUM(clips.views_count) * 0.1 + SUM(clips.comments_count) * 5) as engagement_score
    FROM clips
    LEFT JOIN artists ON clips.artist_name = artists.name
    WHERE clips.artist_name IS NOT NULL
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY clips.artist_name
    ORDER BY engagement_score DESC
    LIMIT 20`
  ).bind(daysBack).all();
  const topVenues = await c.env.DB.prepare(
    `SELECT 
      clips.venue_name,
      venues.location,
      venues.image_url,
      COUNT(DISTINCT clips.id) as clip_count,
      SUM(clips.views_count) as total_views,
      SUM(clips.likes_count) as total_likes,
      (SUM(clips.likes_count) * 3 + SUM(clips.views_count) * 0.1 + SUM(clips.comments_count) * 5) as engagement_score
    FROM clips
    LEFT JOIN venues ON clips.venue_name = venues.name
    WHERE clips.venue_name IS NOT NULL
    AND clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    GROUP BY clips.venue_name
    ORDER BY engagement_score DESC
    LIMIT 20`
  ).bind(daysBack).all();
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as engagement_score
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    AND clips.is_hidden = 0
    ORDER BY engagement_score DESC
    LIMIT 20`
  ).bind(daysBack).all();
  const trendingHashtags = await c.env.DB.prepare(
    `SELECT 
      hashtag,
      COUNT(*) as usage_count
    FROM (
      SELECT 
        json_each.value as hashtag
      FROM clips,
      json_each(clips.hashtags)
      WHERE clips.created_at >= date('now', '-' || ? || ' days')
      AND clips.is_hidden = 0
      AND clips.hashtags IS NOT NULL
    )
    GROUP BY hashtag
    ORDER BY usage_count DESC
    LIMIT 20`
  ).bind(daysBack).all();
  return c.json({
    range,
    topArtists: topArtists.results || [],
    topVenues: topVenues.results || [],
    topClips: topClips.results || [],
    trendingHashtags: trendingHashtags.results || []
  });
}
__name(getTrendAnalysis, "getTrendAnalysis");
async function trackProfileView(c) {
  const profileUserId = c.req.param("userId");
  const mochaUser = c.get("user");
  if (mochaUser && profileUserId === mochaUser.id) {
    return c.json({ success: true });
  }
  await c.env.DB.prepare(
    `INSERT INTO profile_views (profile_user_id, viewer_user_id, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`
  ).bind(profileUserId, mochaUser?.id || null).run();
  return c.json({ success: true });
}
__name(trackProfileView, "trackProfileView");
async function trackClipShare(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { clip_id, platform: platform2 } = body;
  if (!clip_id) {
    return c.json({ error: "clip_id is required" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO clip_shares (clip_id, shared_by, platform, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(clip_id, mochaUser.id, platform2 || null).run();
  return c.json({ success: true });
}
__name(trackClipShare, "trackClipShare");
async function getClipAnalytics(c) {
  const clipId = c.req.param("clipId");
  const mochaUser = c.get("user");
  const clip = await c.env.DB.prepare(
    "SELECT mocha_user_id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  if (mochaUser && clip.mocha_user_id !== mochaUser.id) {
    const userProfile = await c.env.DB.prepare(
      "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    if (!userProfile || !userProfile.is_admin) {
      return c.json({ error: "Access denied" }, 403);
    }
  }
  const clipStats = await c.env.DB.prepare(
    "SELECT * FROM clips WHERE id = ?"
  ).bind(clipId).first();
  const shareCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clip_shares WHERE clip_id = ?"
  ).bind(clipId).first();
  const saveCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM saved_clips WHERE clip_id = ?"
  ).bind(clipId).first();
  const engagementRate = clipStats && clipStats.views_count ? ((clipStats.likes_count + clipStats.comments_count) / clipStats.views_count * 100).toFixed(2) : 0;
  const viewsOverTime = await c.env.DB.prepare(
    `SELECT 
      date(created_at) as date,
      COUNT(*) as views
    FROM profile_views
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date ASC`
  ).all();
  return c.json({
    views: clipStats?.views_count || 0,
    likes: clipStats?.likes_count || 0,
    comments: clipStats?.comments_count || 0,
    shares: shareCount?.count || 0,
    saves: saveCount?.count || 0,
    engagementRate: parseFloat(engagementRate),
    viewsOverTime: viewsOverTime.results || []
  });
}
__name(getClipAnalytics, "getClipAnalytics");

// src/worker/collaboration-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function createCollaborationRequest(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "artist") {
    return c.json({ error: "Only artists can create collaboration requests" }, 403);
  }
  const body = await c.req.json();
  const { influencer_user_id, brief, compensation, deadline } = body;
  if (!influencer_user_id || !brief || !compensation || !deadline) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  const influencer = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(influencer_user_id).first();
  if (!influencer || influencer.role !== "influencer") {
    return c.json({ error: "Invalid influencer" }, 400);
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO collaboration_requests (
      artist_user_id, 
      influencer_user_id, 
      brief, 
      compensation, 
      deadline,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(mochaUser.id, influencer_user_id, brief, compensation, deadline).run();
  await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
     VALUES (?, 'collaboration', ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    influencer_user_id,
    "sent you a collaboration request",
    mochaUser.id
  ).run();
  return c.json({
    success: true,
    requestId: result.meta.last_row_id
  }, 201);
}
__name(createCollaborationRequest, "createCollaborationRequest");
async function getCollaborationRequests(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile) {
    return c.json({ error: "Profile not found" }, 404);
  }
  let requests;
  if (userProfile.role === "influencer") {
    requests = await c.env.DB.prepare(
      `SELECT 
        collaboration_requests.*,
        user_profiles.display_name as artist_name,
        user_profiles.profile_image_url as artist_avatar
      FROM collaboration_requests
      LEFT JOIN user_profiles ON collaboration_requests.artist_user_id = user_profiles.mocha_user_id
      WHERE collaboration_requests.influencer_user_id = ?
      ORDER BY collaboration_requests.created_at DESC`
    ).bind(mochaUser.id).all();
  } else if (userProfile.role === "artist") {
    requests = await c.env.DB.prepare(
      `SELECT 
        collaboration_requests.*,
        user_profiles.display_name as influencer_name,
        user_profiles.profile_image_url as influencer_avatar
      FROM collaboration_requests
      LEFT JOIN user_profiles ON collaboration_requests.influencer_user_id = user_profiles.mocha_user_id
      WHERE collaboration_requests.artist_user_id = ?
      ORDER BY collaboration_requests.created_at DESC`
    ).bind(mochaUser.id).all();
  } else {
    return c.json({ requests: [] });
  }
  return c.json({ requests: requests.results || [] });
}
__name(getCollaborationRequests, "getCollaborationRequests");
async function acceptCollaborationRequest(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const requestId = c.req.param("requestId");
  const request = await c.env.DB.prepare(
    "SELECT * FROM collaboration_requests WHERE id = ?"
  ).bind(requestId).first();
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  if (request.influencer_user_id !== mochaUser.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  await c.env.DB.prepare(
    `UPDATE collaboration_requests 
     SET status = 'accepted', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(requestId).run();
  await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
     VALUES (?, 'collaboration', ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    request.artist_user_id,
    "accepted your collaboration request",
    mochaUser.id
  ).run();
  return c.json({ success: true });
}
__name(acceptCollaborationRequest, "acceptCollaborationRequest");
async function rejectCollaborationRequest(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const requestId = c.req.param("requestId");
  const request = await c.env.DB.prepare(
    "SELECT * FROM collaboration_requests WHERE id = ?"
  ).bind(requestId).first();
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  if (request.influencer_user_id !== mochaUser.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  await c.env.DB.prepare(
    `UPDATE collaboration_requests 
     SET status = 'rejected', updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(requestId).run();
  return c.json({ success: true });
}
__name(rejectCollaborationRequest, "rejectCollaborationRequest");
async function pinClipToArtist(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("clipId");
  const clip = await c.env.DB.prepare(
    "SELECT artist_name FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip || !clip.artist_name) {
    return c.json({ error: "Clip not found or has no artist" }, 404);
  }
  const artist = await c.env.DB.prepare(
    "SELECT id FROM artists WHERE name = ?"
  ).bind(clip.artist_name).first();
  if (!artist) {
    return c.json({ error: "Artist not found" }, 404);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role, is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "artist" && !userProfile.is_admin) {
    return c.json({ error: "Only artists can pin clips" }, 403);
  }
  await c.env.DB.prepare(
    `INSERT INTO artist_pinned_clips (artist_id, clip_id, pinned_by, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(artist_id, clip_id) DO NOTHING`
  ).bind(artist.id, clipId, mochaUser.id).run();
  return c.json({ success: true });
}
__name(pinClipToArtist, "pinClipToArtist");
async function unpinClipFromArtist(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("clipId");
  await c.env.DB.prepare(
    "DELETE FROM artist_pinned_clips WHERE clip_id = ? AND pinned_by = ?"
  ).bind(clipId, mochaUser.id).run();
  return c.json({ success: true });
}
__name(unpinClipFromArtist, "unpinClipFromArtist");
async function getPinnedClips(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const pinnedClips = await c.env.DB.prepare(
    `SELECT clip_id 
     FROM artist_pinned_clips 
     WHERE pinned_by = ?`
  ).bind(mochaUser.id).all();
  return c.json({
    pinnedClipIds: (pinnedClips.results || []).map((r) => r.clip_id)
  });
}
__name(getPinnedClips, "getPinnedClips");

// src/worker/index.ts
init_gamification_endpoints();

// src/worker/live-polls-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function createLivePoll(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const body = await c.req.json();
  const { live_session_id, question, options } = body;
  if (!live_session_id || !question || !options || !Array.isArray(options) || options.length < 2) {
    return c.json({ error: "live_session_id, question, and at least 2 options are required" }, 400);
  }
  const session = await c.env.DB.prepare(
    "SELECT id FROM live_sessions WHERE id = ? AND status = 'live'"
  ).bind(live_session_id).first();
  if (!session) {
    return c.json({ error: "Live session not found or not active" }, 404);
  }
  await c.env.DB.prepare(
    `UPDATE live_polls 
     SET is_active = 0, ended_at = CURRENT_TIMESTAMP 
     WHERE live_session_id = ? AND is_active = 1`
  ).bind(live_session_id).run();
  const result = await c.env.DB.prepare(
    `INSERT INTO live_polls (live_session_id, question, options, created_by, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(live_session_id, question, JSON.stringify(options), mochaUser.id).run();
  const newPoll = await c.env.DB.prepare(
    `SELECT * FROM live_polls WHERE id = ?`
  ).bind(result.meta.last_row_id).first();
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(parseInt(live_session_id), {
      type: "poll_created",
      poll: {
        ...newPoll,
        options: JSON.parse(newPoll.options)
      }
    });
  } catch (err) {
    console.error("Failed to broadcast poll:", err);
  }
  return c.json({
    ...newPoll,
    options: JSON.parse(newPoll.options)
  }, 201);
}
__name(createLivePoll, "createLivePoll");
async function voteOnPoll(c) {
  const mochaUser = c.get("user");
  const pollId = c.req.param("pollId");
  const body = await c.req.json();
  const { option_index } = body;
  if (typeof option_index !== "number") {
    return c.json({ error: "option_index is required" }, 400);
  }
  const poll = await c.env.DB.prepare(
    `SELECT id, live_session_id, options, is_active FROM live_polls WHERE id = ?`
  ).bind(pollId).first();
  if (!poll) {
    return c.json({ error: "Poll not found" }, 404);
  }
  if (!poll.is_active) {
    return c.json({ error: "Poll is no longer active" }, 400);
  }
  const options = JSON.parse(poll.options);
  if (option_index < 0 || option_index >= options.length) {
    return c.json({ error: "Invalid option_index" }, 400);
  }
  const userId = mochaUser?.id || null;
  const existingVote = await c.env.DB.prepare(
    `SELECT id FROM live_poll_votes WHERE poll_id = ? AND mocha_user_id ${userId ? "= ?" : "IS NULL"}`
  ).bind(userId ? pollId : pollId, userId || void 0).first();
  if (existingVote) {
    return c.json({ error: "You have already voted on this poll" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO live_poll_votes (poll_id, mocha_user_id, option_index, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(pollId, userId, option_index).run();
  const results = await getPollResults(c.env, parseInt(pollId));
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(poll.live_session_id, {
      type: "poll_updated",
      poll_id: pollId,
      results
    });
  } catch (err) {
    console.error("Failed to broadcast poll update:", err);
  }
  return c.json({ success: true, results });
}
__name(voteOnPoll, "voteOnPoll");
async function getLivePollResults(c) {
  const pollId = c.req.param("pollId");
  const results = await getPollResults(c.env, parseInt(pollId));
  return c.json(results);
}
__name(getLivePollResults, "getLivePollResults");
async function getActivePoll(c) {
  const sessionId = c.req.param("sessionId");
  const poll = await c.env.DB.prepare(
    `SELECT * FROM live_polls WHERE live_session_id = ? AND is_active = 1 LIMIT 1`
  ).bind(sessionId).first();
  if (!poll) {
    return c.json({ poll: null });
  }
  const results = await getPollResults(c.env, poll.id);
  return c.json({
    poll: {
      ...poll,
      options: JSON.parse(poll.options),
      results
    }
  });
}
__name(getActivePoll, "getActivePoll");
async function endLivePoll(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const pollId = c.req.param("pollId");
  const poll = await c.env.DB.prepare(
    `SELECT live_session_id FROM live_polls WHERE id = ?`
  ).bind(pollId).first();
  if (!poll) {
    return c.json({ error: "Poll not found" }, 404);
  }
  await c.env.DB.prepare(
    `UPDATE live_polls SET is_active = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(pollId).run();
  const results = await getPollResults(c.env, parseInt(pollId));
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(poll.live_session_id, {
      type: "poll_ended",
      poll_id: pollId,
      results
    });
  } catch (err) {
    console.error("Failed to broadcast poll end:", err);
  }
  return c.json({ success: true, results });
}
__name(endLivePoll, "endLivePoll");
async function getPollResults(env2, pollId) {
  const poll = await env2.DB.prepare(
    `SELECT options FROM live_polls WHERE id = ?`
  ).bind(pollId).first();
  if (!poll) {
    return null;
  }
  const options = JSON.parse(poll.options);
  const votes = await env2.DB.prepare(
    `SELECT option_index, COUNT(*) as count 
     FROM live_poll_votes 
     WHERE poll_id = ?
     GROUP BY option_index`
  ).bind(pollId).all();
  const totalVotes = await env2.DB.prepare(
    `SELECT COUNT(*) as count FROM live_poll_votes WHERE poll_id = ?`
  ).bind(pollId).first();
  const total = totalVotes?.count || 0;
  const results = options.map((_option, index) => {
    const voteCount = (votes.results || []).find((v) => v.option_index === index);
    const count3 = voteCount ? voteCount.count : 0;
    const percentage = total > 0 ? Math.round(count3 / total * 100) : 0;
    return {
      option_index: index,
      votes: count3,
      percentage
    };
  });
  return {
    total_votes: total,
    results
  };
}
__name(getPollResults, "getPollResults");

// src/worker/gdpr-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function exportUserData(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const profile3 = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    const clips = await c.env.DB.prepare(
      "SELECT * FROM clips WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const comments = await c.env.DB.prepare(
      "SELECT * FROM comments WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const likes = await c.env.DB.prepare(
      "SELECT * FROM clip_likes WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const savedClips = await c.env.DB.prepare(
      "SELECT * FROM saved_clips WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const follows = await c.env.DB.prepare(
      "SELECT * FROM follows WHERE follower_id = ? OR following_id = ?"
    ).bind(mochaUser.id, mochaUser.id).all();
    const notifications = await c.env.DB.prepare(
      "SELECT * FROM notifications WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const points = await c.env.DB.prepare(
      "SELECT * FROM user_points WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    const pointTransactions = await c.env.DB.prepare(
      "SELECT * FROM point_transactions WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const badges = await c.env.DB.prepare(
      `SELECT badges.* FROM user_badges 
       JOIN badges ON user_badges.badge_id = badges.id 
       WHERE user_badges.mocha_user_id = ?`
    ).bind(mochaUser.id).all();
    const subscriptions = await c.env.DB.prepare(
      "SELECT * FROM subscriptions WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const transactions = await c.env.DB.prepare(
      "SELECT * FROM transactions WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).all();
    const dataPackage = {
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      user: {
        id: mochaUser.id,
        email: mochaUser.google_user_data.email,
        name: mochaUser.google_user_data.name,
        profile: profile3 || null
      },
      content: {
        clips: clips.results || [],
        comments: comments.results || [],
        likes: likes.results || [],
        savedClips: savedClips.results || []
      },
      social: {
        follows: follows.results || [],
        notifications: notifications.results || []
      },
      gamification: {
        points: points || null,
        pointTransactions: pointTransactions.results || [],
        badges: badges.results || []
      },
      financial: {
        subscriptions: subscriptions.results || [],
        transactions: transactions.results || []
      }
    };
    return c.json(dataPackage, 200, {
      "Content-Disposition": `attachment; filename="momentum-data-export-${mochaUser.id}.json"`
    });
  } catch (error3) {
    console.error("Data export error:", error3);
    return c.json({ error: "Failed to export data" }, 500);
  }
}
__name(exportUserData, "exportUserData");
async function requestAccountDeletion(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { reason } = body;
  try {
    await c.env.DB.prepare(
      `INSERT INTO account_deletion_requests 
       (mocha_user_id, reason, status, requested_at, created_at, updated_at)
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(mochaUser.id, reason || null).run();
    return c.json({
      success: true,
      message: "Account deletion request submitted. This will be processed within 30 days."
    });
  } catch (error3) {
    console.error("Deletion request error:", error3);
    return c.json({ error: "Failed to submit deletion request" }, 500);
  }
}
__name(requestAccountDeletion, "requestAccountDeletion");
async function processAccountDeletion(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const requestId = c.req.param("requestId");
  try {
    const request = await c.env.DB.prepare(
      "SELECT mocha_user_id FROM account_deletion_requests WHERE id = ? AND status = 'pending'"
    ).bind(requestId).first();
    if (!request) {
      return c.json({ error: "Deletion request not found" }, 404);
    }
    const userId = request.mocha_user_id;
    await c.env.DB.prepare("DELETE FROM user_profiles WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM notifications WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM follows WHERE follower_id = ? OR following_id = ?").bind(userId, userId).run();
    await c.env.DB.prepare("DELETE FROM saved_clips WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM clip_likes WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM user_points WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM point_transactions WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM user_badges WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM two_factor_auth WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare("DELETE FROM subscriptions WHERE mocha_user_id = ?").bind(userId).run();
    await c.env.DB.prepare(
      "UPDATE clips SET mocha_user_id = 'deleted_user' WHERE mocha_user_id = ?"
    ).bind(userId).run();
    await c.env.DB.prepare(
      "UPDATE comments SET mocha_user_id = 'deleted_user' WHERE mocha_user_id = ?"
    ).bind(userId).run();
    await c.env.DB.prepare(
      `UPDATE account_deletion_requests 
       SET status = 'completed', processed_at = CURRENT_TIMESTAMP, processed_by = ?
       WHERE id = ?`
    ).bind(mochaUser.id, requestId).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Account deletion error:", error3);
    return c.json({ error: "Failed to process account deletion" }, 500);
  }
}
__name(processAccountDeletion, "processAccountDeletion");
async function getDeletionRequests(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const status = c.req.query("status") || "pending";
  const requests = await c.env.DB.prepare(
    `SELECT 
      account_deletion_requests.*,
      user_profiles.display_name,
      user_profiles.profile_image_url
    FROM account_deletion_requests
    LEFT JOIN user_profiles ON account_deletion_requests.mocha_user_id = user_profiles.mocha_user_id
    WHERE account_deletion_requests.status = ?
    ORDER BY account_deletion_requests.requested_at DESC`
  ).bind(status).all();
  return c.json({ requests: requests.results || [] });
}
__name(getDeletionRequests, "getDeletionRequests");
async function updatePrivacySettings(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const {
    profile_visibility,
    allow_tagging,
    show_online_status,
    email_notifications,
    push_notifications
  } = body;
  try {
    await c.env.DB.prepare(
      `INSERT INTO user_privacy_settings 
       (mocha_user_id, profile_visibility, allow_tagging, show_online_status, 
        email_notifications, push_notifications, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(mocha_user_id) DO UPDATE SET
         profile_visibility = COALESCE(?, profile_visibility),
         allow_tagging = COALESCE(?, allow_tagging),
         show_online_status = COALESCE(?, show_online_status),
         email_notifications = COALESCE(?, email_notifications),
         push_notifications = COALESCE(?, push_notifications),
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      mochaUser.id,
      profile_visibility,
      allow_tagging,
      show_online_status,
      email_notifications,
      push_notifications,
      profile_visibility,
      allow_tagging,
      show_online_status,
      email_notifications,
      push_notifications
    ).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Privacy settings error:", error3);
    return c.json({ error: "Failed to update privacy settings" }, 500);
  }
}
__name(updatePrivacySettings, "updatePrivacySettings");
async function getPrivacySettings(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const settings = await c.env.DB.prepare(
    "SELECT * FROM user_privacy_settings WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  return c.json({
    settings: settings || {
      profile_visibility: "public",
      allow_tagging: true,
      show_online_status: true,
      email_notifications: true,
      push_notifications: true
    }
  });
}
__name(getPrivacySettings, "getPrivacySettings");

// src/worker/ticketmaster-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var TICKETMASTER_API_BASE = "https://app.ticketmaster.com/discovery/v2";
async function searchEvents(c) {
  const query = c.req.query("q") || "";
  const city = c.req.query("city") || "";
  const stateCode = c.req.query("state") || "";
  const startDate = c.req.query("startDate") || "";
  const endDate = c.req.query("endDate") || "";
  const genre = c.req.query("genre") || "";
  const page = c.req.query("page") || "0";
  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: "Ticketmaster API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      apikey: c.env.TICKETMASTER_API_KEY,
      page,
      size: "20"
    });
    if (query) params.append("keyword", query);
    if (city) params.append("city", city);
    if (stateCode) params.append("stateCode", stateCode);
    if (startDate) params.append("startDateTime", startDate);
    if (endDate) params.append("endDateTime", endDate);
    if (genre) params.append("classificationName", genre);
    const response = await fetch(`${TICKETMASTER_API_BASE}/events.json?${params}`);
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }
    const data = await response.json();
    c.header("Cache-Control", "public, max-age=600");
    return c.json({
      events: data._embedded?.events || [],
      page: data.page || {}
    });
  } catch (error3) {
    console.error("Ticketmaster search error:", error3);
    return c.json({ error: "Failed to search events", events: [] }, 500);
  }
}
__name(searchEvents, "searchEvents");
async function getEventById(c) {
  const eventId = c.req.param("eventId");
  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: "Ticketmaster API not configured" }, 503);
  }
  try {
    const response = await fetch(
      `${TICKETMASTER_API_BASE}/events/${eventId}.json?apikey=${c.env.TICKETMASTER_API_KEY}`
    );
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }
    const event = await response.json();
    c.header("Cache-Control", "public, max-age=1800");
    return c.json(event);
  } catch (error3) {
    console.error("Ticketmaster event details error:", error3);
    return c.json({ error: "Failed to fetch event details" }, 500);
  }
}
__name(getEventById, "getEventById");
async function getVenueById2(c) {
  const venueId = c.req.param("venueId");
  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: "Ticketmaster API not configured" }, 503);
  }
  try {
    const response = await fetch(
      `${TICKETMASTER_API_BASE}/venues/${venueId}.json?apikey=${c.env.TICKETMASTER_API_KEY}`
    );
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }
    const venue = await response.json();
    c.header("Cache-Control", "public, max-age=3600");
    return c.json(venue);
  } catch (error3) {
    console.error("Ticketmaster venue details error:", error3);
    return c.json({ error: "Failed to fetch venue details" }, 500);
  }
}
__name(getVenueById2, "getVenueById");
async function searchAttractions(c) {
  const query = c.req.query("q") || "";
  const page = c.req.query("page") || "0";
  if (!c.env.TICKETMASTER_API_KEY) {
    return c.json({ error: "Ticketmaster API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      apikey: c.env.TICKETMASTER_API_KEY,
      keyword: query,
      page,
      size: "20"
    });
    const response = await fetch(`${TICKETMASTER_API_BASE}/attractions.json?${params}`);
    if (!response.ok) {
      throw new Error(`Ticketmaster API error: ${response.status}`);
    }
    const data = await response.json();
    c.header("Cache-Control", "public, max-age=1800");
    return c.json({
      attractions: data._embedded?.attractions || [],
      page: data.page || {}
    });
  } catch (error3) {
    console.error("Ticketmaster attractions search error:", error3);
    return c.json({ error: "Failed to search attractions", attractions: [] }, 500);
  }
}
__name(searchAttractions, "searchAttractions");
async function createTicketPurchase(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const {
    event_id,
    event_name,
    event_date,
    venue_name,
    ticket_url,
    ticket_price,
    quantity,
    referrer_user_id
  } = body;
  if (!event_id || !ticket_url || !ticket_price || !quantity) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  try {
    await c.env.DB.prepare(
      `INSERT INTO affiliate_ticket_clicks 
       (mocha_user_id, referrer_user_id, event_id, event_name, event_date, venue_name,
        ticket_url, estimated_price, quantity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      mochaUser.id,
      referrer_user_id || null,
      event_id,
      event_name || null,
      event_date || null,
      venue_name || null,
      ticket_url,
      ticket_price,
      quantity
    ).run();
    if (referrer_user_id) {
      const { awardPoints: awardPoints2 } = await Promise.resolve().then(() => (init_gamification_endpoints(), gamification_endpoints_exports));
      await awardPoints2(c.env, referrer_user_id, 5, "Referred ticket purchase");
    }
    return c.json({
      success: true,
      redirectUrl: ticket_url
    });
  } catch (error3) {
    console.error("Ticket purchase tracking error:", error3);
    return c.json({ error: "Failed to track purchase" }, 500);
  }
}
__name(createTicketPurchase, "createTicketPurchase");

// src/worker/google-maps-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var GOOGLE_MAPS_API_BASE = "https://maps.googleapis.com/maps/api";
async function geocodeAddress(c) {
  const address = c.req.query("address");
  if (!address) {
    return c.json({ error: "Address is required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      address,
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/geocode/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK") {
      throw new Error(`Geocoding failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=86400");
    return c.json({
      results: data.results,
      location: data.results[0]?.geometry?.location || null
    });
  } catch (error3) {
    console.error("Geocoding error:", error3);
    return c.json({ error: "Failed to geocode address" }, 500);
  }
}
__name(geocodeAddress, "geocodeAddress");
async function reverseGeocode(c) {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");
  if (!lat || !lng) {
    return c.json({ error: "Latitude and longitude are required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      latlng: `${lat},${lng}`,
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/geocode/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK") {
      throw new Error(`Reverse geocoding failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      results: data.results,
      formattedAddress: data.results[0]?.formatted_address || null
    });
  } catch (error3) {
    console.error("Reverse geocoding error:", error3);
    return c.json({ error: "Failed to reverse geocode" }, 500);
  }
}
__name(reverseGeocode, "reverseGeocode");
async function searchNearbyVenues(c) {
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");
  const radius = c.req.query("radius") || "5000";
  const type = c.req.query("type") || "night_club";
  if (!lat || !lng) {
    return c.json({ error: "Latitude and longitude are required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius,
      type,
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/nearbysearch/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Places search failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=1800");
    return c.json({
      venues: data.results || [],
      nextPageToken: data.next_page_token || null
    });
  } catch (error3) {
    console.error("Places search error:", error3);
    return c.json({ error: "Failed to search venues", venues: [] }, 500);
  }
}
__name(searchNearbyVenues, "searchNearbyVenues");
async function getPlaceDetails(c) {
  const placeId = c.req.query("place_id");
  if (!placeId) {
    return c.json({ error: "Place ID is required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: "name,formatted_address,geometry,photos,rating,user_ratings_total,opening_hours,website,formatted_phone_number",
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/details/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK") {
      throw new Error(`Place details failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      place: data.result || null
    });
  } catch (error3) {
    console.error("Place details error:", error3);
    return c.json({ error: "Failed to get place details" }, 500);
  }
}
__name(getPlaceDetails, "getPlaceDetails");
async function calculateDistance(c) {
  const origins = c.req.query("origins");
  const destinations = c.req.query("destinations");
  if (!origins || !destinations) {
    return c.json({ error: "Origins and destinations are required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      origins,
      destinations,
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/distancematrix/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK") {
      throw new Error(`Distance calculation failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=3600");
    return c.json({
      distance: data.rows[0]?.elements[0] || null
    });
  } catch (error3) {
    console.error("Distance calculation error:", error3);
    return c.json({ error: "Failed to calculate distance" }, 500);
  }
}
__name(calculateDistance, "calculateDistance");
async function autocompleteVenue(c) {
  const input = c.req.query("input");
  const lat = c.req.query("lat");
  const lng = c.req.query("lng");
  if (!input) {
    return c.json({ error: "Input is required" }, 400);
  }
  if (!c.env.GOOGLE_MAPS_API_KEY) {
    return c.json({ error: "Google Maps API not configured" }, 503);
  }
  try {
    const params = new URLSearchParams({
      input,
      types: "establishment",
      key: c.env.GOOGLE_MAPS_API_KEY
    });
    if (lat && lng) {
      params.append("location", `${lat},${lng}`);
      params.append("radius", "50000");
    }
    const response = await fetch(`${GOOGLE_MAPS_API_BASE}/place/autocomplete/json?${params}`);
    const data = await response.json();
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      throw new Error(`Autocomplete failed: ${data.status}`);
    }
    c.header("Cache-Control", "public, max-age=300");
    return c.json({
      predictions: data.predictions || []
    });
  } catch (error3) {
    console.error("Autocomplete error:", error3);
    return c.json({ error: "Failed to autocomplete", predictions: [] }, 500);
  }
}
__name(autocompleteVenue, "autocompleteVenue");

// src/worker/rating-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function rateClip(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  const body = await c.req.json();
  const { rating } = body;
  if (!rating || rating < 1 || rating > 5) {
    return c.json({ error: "Rating must be between 1 and 5" }, 400);
  }
  try {
    const clip = await c.env.DB.prepare(
      "SELECT id, mocha_user_id FROM clips WHERE id = ?"
    ).bind(clipId).first();
    if (!clip) {
      return c.json({ error: "Clip not found" }, 404);
    }
    const existingRating = await c.env.DB.prepare(
      "SELECT rating FROM clip_ratings WHERE clip_id = ? AND mocha_user_id = ?"
    ).bind(clipId, mochaUser.id).first();
    if (existingRating) {
      await c.env.DB.prepare(
        "UPDATE clip_ratings SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE clip_id = ? AND mocha_user_id = ?"
      ).bind(rating, clipId, mochaUser.id).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO clip_ratings (clip_id, mocha_user_id, rating, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(clipId, mochaUser.id, rating).run();
    }
    const ratingStats = await c.env.DB.prepare(
      "SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM clip_ratings WHERE clip_id = ?"
    ).bind(clipId).first();
    if (ratingStats) {
      await c.env.DB.prepare(
        "UPDATE clips SET average_rating = ?, rating_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(ratingStats.avg_rating || 0, ratingStats.rating_count || 0, clipId).run();
    }
    if (!existingRating) {
      const { awardPoints: awardPoints2 } = await Promise.resolve().then(() => (init_gamification_endpoints(), gamification_endpoints_exports));
      await awardPoints2(c.env, mochaUser.id, 2, "Rated a clip", parseInt(clipId));
    }
    return c.json({
      success: true,
      rated: true,
      newRating: rating,
      averageRating: ratingStats?.avg_rating || 0,
      ratingCount: ratingStats?.rating_count || 0
    });
  } catch (error3) {
    console.error("Rating error:", error3);
    return c.json({ error: "Failed to rate clip" }, 500);
  }
}
__name(rateClip, "rateClip");
async function getUserClipRating(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ rating: null });
  }
  const clipId = c.req.param("id");
  try {
    const rating = await c.env.DB.prepare(
      "SELECT rating FROM clip_ratings WHERE clip_id = ? AND mocha_user_id = ?"
    ).bind(clipId, mochaUser.id).first();
    return c.json({ rating: rating?.rating || null });
  } catch (error3) {
    console.error("Get rating error:", error3);
    return c.json({ rating: null });
  }
}
__name(getUserClipRating, "getUserClipRating");

// src/worker/favorite-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function getFavoriteArtists(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const favorites = await c.env.DB.prepare(
      `SELECT 
        user_favorite_artists.*,
        artists.name,
        artists.image_url,
        artists.bio
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?
      ORDER BY user_favorite_artists.created_at DESC`
    ).bind(mochaUser.id).all();
    return c.json({ artists: favorites.results || [] });
  } catch (error3) {
    console.error("Get favorite artists error:", error3);
    return c.json({ error: "Failed to get favorite artists" }, 500);
  }
}
__name(getFavoriteArtists, "getFavoriteArtists");
async function toggleFavoriteArtist(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { artist_id } = body;
  if (!artist_id) {
    return c.json({ error: "artist_id is required" }, 400);
  }
  try {
    const existing = await c.env.DB.prepare(
      "SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?"
    ).bind(mochaUser.id, artist_id).first();
    if (existing) {
      await c.env.DB.prepare(
        "DELETE FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?"
      ).bind(mochaUser.id, artist_id).run();
      return c.json({ favorited: false });
    } else {
      await c.env.DB.prepare(
        "INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
      ).bind(mochaUser.id, artist_id).run();
      return c.json({ favorited: true });
    }
  } catch (error3) {
    console.error("Toggle favorite artist error:", error3);
    return c.json({ error: "Failed to update favorite artist" }, 500);
  }
}
__name(toggleFavoriteArtist, "toggleFavoriteArtist");
async function favoriteClip(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  try {
    const clip = await c.env.DB.prepare(
      "SELECT id, artist_name FROM clips WHERE id = ?"
    ).bind(clipId).first();
    if (!clip) {
      return c.json({ error: "Clip not found" }, 404);
    }
    if (!clip.artist_name) {
      return c.json({ error: "Clip has no associated artist" }, 400);
    }
    let artist = await c.env.DB.prepare(
      "SELECT id FROM artists WHERE name = ?"
    ).bind(clip.artist_name).first();
    if (!artist) {
      const result = await c.env.DB.prepare(
        "INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(clip.artist_name).run();
      artist = { id: result.meta.last_row_id };
    }
    const favoriteArtist = await c.env.DB.prepare(
      "SELECT id FROM user_favorite_artists WHERE mocha_user_id = ? AND artist_id = ?"
    ).bind(mochaUser.id, artist.id).first();
    if (!favoriteArtist) {
      await c.env.DB.prepare(
        "INSERT INTO user_favorite_artists (mocha_user_id, artist_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
      ).bind(mochaUser.id, artist.id).run();
    }
    const existing = await c.env.DB.prepare(
      "SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?"
    ).bind(mochaUser.id, artist.id, clipId).first();
    if (existing) {
      await c.env.DB.prepare(
        "DELETE FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND artist_id = ? AND clip_id = ?"
      ).bind(mochaUser.id, artist.id, clipId).run();
      return c.json({ favorited: false });
    } else {
      await c.env.DB.prepare(
        "INSERT INTO user_favorite_clips_by_artist (mocha_user_id, artist_id, clip_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(mochaUser.id, artist.id, clipId).run();
      return c.json({ favorited: true });
    }
  } catch (error3) {
    console.error("Favorite clip error:", error3);
    return c.json({ error: "Failed to favorite clip" }, 500);
  }
}
__name(favoriteClip, "favoriteClip");
async function getFavoriteClipsByArtist(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const artistId = c.req.query("artist_id");
  try {
    let query = `
      SELECT 
        user_favorite_clips_by_artist.*,
        clips.*,
        artists.name as artist_name,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM user_favorite_clips_by_artist
      LEFT JOIN clips ON user_favorite_clips_by_artist.clip_id = clips.id
      LEFT JOIN artists ON user_favorite_clips_by_artist.artist_id = artists.id
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE user_favorite_clips_by_artist.mocha_user_id = ?
    `;
    const bindings = [mochaUser.id];
    if (artistId) {
      query += " AND user_favorite_clips_by_artist.artist_id = ?";
      bindings.push(artistId);
    }
    query += " ORDER BY user_favorite_clips_by_artist.created_at DESC";
    const clips = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json({ clips: clips.results || [] });
  } catch (error3) {
    console.error("Get favorite clips error:", error3);
    return c.json({ error: "Failed to get favorite clips" }, 500);
  }
}
__name(getFavoriteClipsByArtist, "getFavoriteClipsByArtist");
async function checkClipFavorited(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ favorited: false });
  }
  const clipId = c.req.param("id");
  try {
    const favorited = await c.env.DB.prepare(
      "SELECT id FROM user_favorite_clips_by_artist WHERE mocha_user_id = ? AND clip_id = ?"
    ).bind(mochaUser.id, clipId).first();
    return c.json({ favorited: !!favorited });
  } catch (error3) {
    console.error("Check clip favorited error:", error3);
    return c.json({ favorited: false });
  }
}
__name(checkClipFavorited, "checkClipFavorited");

// src/worker/profile-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function getUserStats2(c) {
  const userId = c.req.param("userId");
  try {
    const clips = await c.env.DB.prepare(
      "SELECT id, views_count, average_rating FROM clips WHERE mocha_user_id = ? AND is_hidden = 0"
    ).bind(userId).all();
    const clipsArray = clips.results || [];
    const totalClipsPosted = clipsArray.length;
    const totalViewsOnClips = clipsArray.reduce((sum, clip) => sum + (clip.views_count || 0), 0);
    const clipsWithRatings = clipsArray.filter((clip) => clip.average_rating && clip.average_rating > 0);
    const userAverageClipRating = clipsWithRatings.length > 0 ? clipsWithRatings.reduce((sum, clip) => sum + (clip.average_rating || 0), 0) / clipsWithRatings.length : 0;
    return c.json({
      totalClipsPosted,
      totalViewsOnClips,
      userAverageClipRating: Number(userAverageClipRating.toFixed(2))
    });
  } catch (error3) {
    console.error("Get user stats error:", error3);
    return c.json({ error: "Failed to get user stats" }, 500);
  }
}
__name(getUserStats2, "getUserStats");
async function getUserFavoriteArtistsWithClips(c) {
  const userId = c.req.param("userId");
  try {
    const artists = await c.env.DB.prepare(
      `SELECT 
        user_favorite_artists.artist_id,
        artists.name,
        artists.image_url,
        artists.bio
      FROM user_favorite_artists
      LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
      WHERE user_favorite_artists.mocha_user_id = ?
      ORDER BY user_favorite_artists.created_at DESC`
    ).bind(userId).all();
    const artistsWithClips = [];
    for (const artist of artists.results || []) {
      const clips = await c.env.DB.prepare(
        `SELECT 
          clips.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar
        FROM user_favorite_clips_by_artist
        LEFT JOIN clips ON user_favorite_clips_by_artist.clip_id = clips.id
        LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
        WHERE user_favorite_clips_by_artist.mocha_user_id = ?
        AND user_favorite_clips_by_artist.artist_id = ?
        ORDER BY user_favorite_clips_by_artist.created_at DESC
        LIMIT 20`
      ).bind(userId, artist.artist_id).all();
      artistsWithClips.push({
        artist,
        clips: clips.results || []
      });
    }
    return c.json({ favoriteArtists: artistsWithClips });
  } catch (error3) {
    console.error("Get favorite artists with clips error:", error3);
    return c.json({ error: "Failed to get favorite artists with clips" }, 500);
  }
}
__name(getUserFavoriteArtistsWithClips, "getUserFavoriteArtistsWithClips");

// src/worker/discover-prioritized-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function getPrioritizedShows(c) {
  const userId = c.req.query("user_id");
  const latitude = c.req.query("latitude");
  const longitude = c.req.query("longitude");
  const radiusMiles = parseFloat(c.req.query("radius_miles") || "60");
  try {
    const prioritizedShows = [];
    let favoriteArtistIds = [];
    let favoriteArtistNames = [];
    if (userId) {
      const favorites = await c.env.DB.prepare(
        `SELECT 
          user_favorite_artists.artist_id,
          artists.name
        FROM user_favorite_artists
        LEFT JOIN artists ON user_favorite_artists.artist_id = artists.id
        WHERE user_favorite_artists.mocha_user_id = ?`
      ).bind(userId).all();
      favoriteArtistIds = (favorites.results || []).map((f) => f.artist_id);
      favoriteArtistNames = (favorites.results || []).map((f) => f.name).filter(Boolean);
    }
    const liveSessions = await c.env.DB.prepare(
      `SELECT 
        live_sessions.id as session_id,
        live_sessions.title,
        live_sessions.start_time,
        clips.artist_name,
        clips.venue_name,
        clips.location,
        venues.id as venue_id,
        venues.image_url as venue_image,
        artists.image_url as artist_image,
        COUNT(DISTINCT clips.id) as moments_count,
        SUM(clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) as trending_score
      FROM live_sessions
      LEFT JOIN live_session_clips ON live_sessions.id = live_session_clips.live_session_id
      LEFT JOIN clips ON live_session_clips.clip_id = clips.id
      LEFT JOIN venues ON clips.venue_name = venues.name
      LEFT JOIN artists ON clips.artist_name = artists.name
      WHERE live_sessions.status = 'live'
      AND clips.created_at >= datetime('now', '-2 hours')
      GROUP BY live_sessions.id, clips.artist_name, clips.venue_name
      HAVING moments_count > 0
      ORDER BY trending_score DESC`
    ).all();
    for (const session of liveSessions.results || []) {
      const isFavorite = favoriteArtistNames.includes(session.artist_name);
      prioritizedShows.push({
        type: "live",
        priority: 1,
        session_id: session.session_id,
        artist_name: session.artist_name,
        artist_image: session.artist_image,
        venue_name: session.venue_name,
        location: session.location,
        moments_count: session.moments_count,
        is_live: true,
        is_favorite: isFavorite,
        start_time: session.start_time
      });
    }
    if (latitude && longitude && c.env.GOOGLE_MAPS_API_KEY) {
      try {
        const upcomingShows = await c.env.DB.prepare(
          `SELECT 
            artist_tour_dates.*,
            artists.name as artist_name,
            artists.image_url as artist_image,
            venues.name as venue_name,
            venues.location as venue_location,
            venues.address as venue_address
          FROM artist_tour_dates
          LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
          LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
          WHERE artist_tour_dates.date >= datetime('now')
          AND artist_tour_dates.date <= datetime('now', '+30 days')
          AND venues.address IS NOT NULL`
        ).all();
        for (const show of upcomingShows.results || []) {
          try {
            const geocodeResponse = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(show.venue_address)}&key=${c.env.GOOGLE_MAPS_API_KEY}`
            );
            if (geocodeResponse.ok) {
              const geocodeData = await geocodeResponse.json();
              if (geocodeData.results && geocodeData.results.length > 0) {
                const venueLat = geocodeData.results[0].geometry.location.lat;
                const venueLng = geocodeData.results[0].geometry.location.lng;
                const R = 3959;
                const dLat = (venueLat - parseFloat(latitude)) * Math.PI / 180;
                const dLon = (venueLng - parseFloat(longitude)) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(parseFloat(latitude) * Math.PI / 180) * Math.cos(venueLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c2 = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distance = R * c2;
                if (distance <= radiusMiles) {
                  const isFavorite = favoriteArtistIds.includes(show.artist_id);
                  prioritizedShows.push({
                    type: "nearby_upcoming",
                    priority: isFavorite ? 2 : 2.5,
                    artist_name: show.artist_name,
                    artist_image: show.artist_image,
                    venue_name: show.venue_name,
                    venue_location: show.venue_location,
                    date: show.date,
                    ticket_url: show.ticket_url,
                    distance_miles: distance,
                    is_favorite: isFavorite
                  });
                }
              }
            }
          } catch (err) {
            console.error("Error calculating distance for show:", err);
          }
        }
      } catch (err) {
        console.error("Error fetching nearby shows:", err);
      }
    }
    if (favoriteArtistIds.length > 0) {
      const upcomingFavorites = await c.env.DB.prepare(
        `SELECT 
          artist_tour_dates.*,
          artists.name as artist_name,
          artists.image_url as artist_image,
          venues.name as venue_name,
          venues.location as venue_location
        FROM artist_tour_dates
        LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
        LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
        WHERE artist_tour_dates.artist_id IN (${favoriteArtistIds.map(() => "?").join(",")})
        AND artist_tour_dates.date >= datetime('now')
        AND artist_tour_dates.date <= datetime('now', '+90 days')
        ORDER BY artist_tour_dates.date ASC`
      ).bind(...favoriteArtistIds).all();
      for (const show of upcomingFavorites.results || []) {
        const isDuplicate = prioritizedShows.some(
          (s) => s.type === "nearby_upcoming" && s.artist_name === show.artist_name && s.venue_name === show.venue_name && s.date === show.date
        );
        if (!isDuplicate) {
          prioritizedShows.push({
            type: "upcoming_favorite",
            priority: 3,
            artist_name: show.artist_name,
            artist_image: show.artist_image,
            venue_name: show.venue_name,
            venue_location: show.venue_location,
            date: show.date,
            ticket_url: show.ticket_url,
            is_favorite: true
          });
        }
      }
    }
    if (favoriteArtistIds.length > 0) {
      const favoriteArtists = await c.env.DB.prepare(
        `SELECT 
          artists.*,
          COUNT(DISTINCT clips.id) as clip_count,
          MAX(clips.created_at) as latest_clip
        FROM artists
        LEFT JOIN clips ON clips.artist_name = artists.name AND clips.is_hidden = 0
        WHERE artists.id IN (${favoriteArtistIds.map(() => "?").join(",")})
        GROUP BY artists.id
        HAVING clip_count > 0
        ORDER BY latest_clip DESC`
      ).bind(...favoriteArtistIds).all();
      for (const artist of favoriteArtists.results || []) {
        prioritizedShows.push({
          type: "favorite_artist",
          priority: 4,
          artist_name: artist.name,
          artist_image: artist.image_url,
          bio: artist.bio,
          clip_count: artist.clip_count,
          is_favorite: true
        });
      }
    }
    const trendingClips = await c.env.DB.prepare(
      `SELECT 
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar,
        artists.image_url as artist_image
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      LEFT JOIN artists ON clips.artist_name = artists.name
      WHERE clips.is_hidden = 0
      AND clips.created_at >= date('now', '-7 days')
      ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
      LIMIT 20`
    ).all();
    for (const clip of trendingClips.results || []) {
      const isFavorite = favoriteArtistNames.includes(clip.artist_name);
      prioritizedShows.push({
        type: "trending",
        priority: 5,
        artist_name: clip.artist_name,
        artist_image: clip.artist_image,
        venue_name: clip.venue_name,
        location: clip.location,
        is_favorite: isFavorite,
        clip
      });
    }
    prioritizedShows.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.is_favorite !== b.is_favorite) {
        return b.is_favorite ? 1 : -1;
      }
      if (a.distance_miles && b.distance_miles) {
        return a.distance_miles - b.distance_miles;
      }
      const aCount = a.moments_count || a.clip_count || 0;
      const bCount = b.moments_count || b.clip_count || 0;
      return bCount - aCount;
    });
    return c.json({ shows: prioritizedShows });
  } catch (error3) {
    console.error("Get prioritized shows error:", error3);
    return c.json({ error: "Failed to get prioritized shows" }, 500);
  }
}
__name(getPrioritizedShows, "getPrioritizedShows");
async function getShowClips(c) {
  const artistName = decodeURIComponent(c.req.param("artistName"));
  const showId = c.req.param("showId");
  const sortBy = c.req.query("sort_by") || "time_posted";
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  try {
    let query = `
      SELECT 
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.artist_name = ?
      AND clips.show_id = ?
      AND clips.is_hidden = 0
    `;
    const bindings = [artistName, showId];
    switch (sortBy) {
      case "clip_rating":
        query += " ORDER BY clips.average_rating DESC, clips.created_at DESC";
        break;
      case "time_posted":
      default:
        query += " ORDER BY clips.created_at ASC";
        break;
    }
    query += " LIMIT ? OFFSET ?";
    bindings.push(String(limit), String(offset));
    const clips = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json({
      clips: clips.results || [],
      page,
      limit,
      hasMore: (clips.results || []).length === limit
    });
  } catch (error3) {
    console.error("Get show clips error:", error3);
    return c.json({ error: "Failed to get show clips" }, 500);
  }
}
__name(getShowClips, "getShowClips");
async function getVenueArchive(c) {
  const venueName = decodeURIComponent(c.req.param("venueName"));
  const sortBy = c.req.query("sort_by") || "date_played";
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  const offset = (page - 1) * limit;
  try {
    let query = `
      SELECT 
        clips.show_id,
        clips.artist_name,
        MIN(clips.timestamp) as show_date,
        COUNT(DISTINCT clips.id) as clip_count,
        AVG(clips.average_rating) as average_show_rating,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM clips
      WHERE clips.venue_name = ?
      AND clips.is_hidden = 0
      AND clips.show_id IS NOT NULL
      GROUP BY clips.show_id, clips.artist_name
    `;
    const bindings = [venueName];
    switch (sortBy) {
      case "average_rating":
        query += " ORDER BY average_show_rating DESC";
        break;
      case "date_played":
      default:
        query += " ORDER BY show_date DESC";
        break;
    }
    query += " LIMIT ? OFFSET ?";
    bindings.push(String(limit), String(offset));
    const shows = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json({
      shows: shows.results || [],
      page,
      limit,
      hasMore: (shows.results || []).length === limit
    });
  } catch (error3) {
    console.error("Get venue archive error:", error3);
    return c.json({ error: "Failed to get venue archive" }, 500);
  }
}
__name(getVenueArchive, "getVenueArchive");

// src/worker/device-token-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import * as crypto4 from "crypto";
async function createDeviceToken(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const deviceToken = crypto4.randomBytes(32).toString("hex");
    const userAgent = c.req.header("user-agent") || "unknown";
    const deviceType = userAgent.includes("Mobile") ? "mobile" : "desktop";
    const expiresAt = /* @__PURE__ */ new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await c.env.DB.prepare(
      `INSERT INTO user_device_tokens (mocha_user_id, device_token, device_name, device_type, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      mochaUser.id,
      deviceToken,
      userAgent.substring(0, 100),
      // Limit to 100 chars
      deviceType,
      expiresAt.toISOString()
    ).run();
    return c.json({ deviceToken, expiresAt });
  } catch (error3) {
    console.error("Create device token error:", error3);
    return c.json({ error: "Failed to create device token" }, 500);
  }
}
__name(createDeviceToken, "createDeviceToken");
async function verifyDeviceToken(c) {
  const body = await c.req.json();
  const { deviceToken } = body;
  if (!deviceToken) {
    return c.json({ error: "Device token required" }, 400);
  }
  try {
    const token = await c.env.DB.prepare(
      `SELECT mocha_user_id, expires_at 
       FROM user_device_tokens 
       WHERE device_token = ? 
       AND expires_at > datetime('now')`
    ).bind(deviceToken).first();
    if (!token) {
      return c.json({ error: "Invalid or expired device token" }, 401);
    }
    await c.env.DB.prepare(
      `UPDATE user_device_tokens 
       SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE device_token = ?`
    ).bind(deviceToken).run();
    const userData = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(token.mocha_user_id).first();
    const emailAccount = await c.env.DB.prepare(
      "SELECT id FROM email_accounts WHERE id = ?"
    ).bind(token.mocha_user_id).first();
    if (emailAccount) {
      const { rawToken } = await createEmailSession(
        c.env.DB,
        token.mocha_user_id
      );
      setEmailSessionCookie(c, rawToken);
    }
    return c.json({
      valid: true,
      userId: token.mocha_user_id,
      profile: userData
    });
  } catch (error3) {
    console.error("Verify device token error:", error3);
    return c.json({ error: "Failed to verify device token" }, 500);
  }
}
__name(verifyDeviceToken, "verifyDeviceToken");
async function getDeviceTokens(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const tokens = await c.env.DB.prepare(
      `SELECT id, device_name, device_type, last_used_at, expires_at, created_at
       FROM user_device_tokens
       WHERE mocha_user_id = ?
       AND expires_at > datetime('now')
       ORDER BY last_used_at DESC`
    ).bind(mochaUser.id).all();
    return c.json({ devices: tokens.results || [] });
  } catch (error3) {
    console.error("Get device tokens error:", error3);
    return c.json({ error: "Failed to get device tokens" }, 500);
  }
}
__name(getDeviceTokens, "getDeviceTokens");
async function revokeDeviceToken(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const tokenId = c.req.param("tokenId");
  try {
    const token = await c.env.DB.prepare(
      "SELECT id FROM user_device_tokens WHERE id = ? AND mocha_user_id = ?"
    ).bind(tokenId, mochaUser.id).first();
    if (!token) {
      return c.json({ error: "Device token not found" }, 404);
    }
    await c.env.DB.prepare(
      "DELETE FROM user_device_tokens WHERE id = ?"
    ).bind(tokenId).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Revoke device token error:", error3);
    return c.json({ error: "Failed to revoke device token" }, 500);
  }
}
__name(revokeDeviceToken, "revokeDeviceToken");
async function revokeAllDeviceTokens(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    await c.env.DB.prepare(
      "DELETE FROM user_device_tokens WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Revoke all device tokens error:", error3);
    return c.json({ error: "Failed to revoke device tokens" }, 500);
  }
}
__name(revokeAllDeviceTokens, "revokeAllDeviceTokens");

// src/worker/auth-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import * as crypto6 from "crypto";

// src/worker/auth-password-utils.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import * as crypto5 from "crypto";
function hashPassword(password) {
  const salt = crypto5.randomBytes(16).toString("hex");
  const hash = crypto5.pbkdf2Sync(password, salt, 1e5, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}
__name(hashPassword, "hashPassword");
function verifyPasswordStored(password, stored) {
  const parts = stored.split(":");
  if (parts.length !== 2) {
    return false;
  }
  const [salt, hash] = parts;
  const verify = crypto5.pbkdf2Sync(password, salt, 1e5, 32, "sha256").toString("hex");
  try {
    return crypto5.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(verify, "hex")
    );
  } catch {
    return false;
  }
}
__name(verifyPasswordStored, "verifyPasswordStored");
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}
__name(normalizeEmail, "normalizeEmail");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");

// src/worker/transactional-email.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
async function sendPasswordResetEmail(opts) {
  const { apiKey, from, to, resetUrl, logResetLinkForDev } = opts;
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) {
    if (logResetLinkForDev) {
      console.info("[password reset] RESEND_API_KEY unset; reset link (dev only):", resetUrl);
    } else {
      console.warn("password reset: RESEND_API_KEY not set; email not sent");
    }
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your Momentum password",
      html: `<p>You requested a password reset for your Momentum account.</p>
<p><a href="${resetUrl}">Choose a new password</a></p>
<p>This link expires in one hour. If you did not request a reset, you can ignore this email.</p>`
    })
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Resend password reset email failed", res.status, text);
    throw new Error("email_provider_error");
  }
}
__name(sendPasswordResetEmail, "sendPasswordResetEmail");

// src/worker/auth-endpoints.ts
var PASSWORD_RESET_TTL_MS = 60 * 60 * 1e3;
function passwordResetAppBaseUrl(c, bodyRedirectBase) {
  const trimmed = bodyRedirectBase?.trim();
  if (trimmed) {
    return trimmed.replace(/\/$/, "");
  }
  const origin = c.req.header("origin")?.trim();
  if (origin) {
    return origin.replace(/\/$/, "");
  }
  const envUrl = typeof c.env.PUBLIC_APP_URL === "string" ? c.env.PUBLIC_APP_URL.trim() : "";
  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }
  try {
    return new URL(c.req.url).origin;
  } catch {
    return "";
  }
}
__name(passwordResetAppBaseUrl, "passwordResetAppBaseUrl");
async function emailSignUp(c) {
  const body = await c.req.json();
  const emailRaw = body.email;
  const password = body.password;
  const displayName = body.display_name?.trim() || "";
  if (!emailRaw || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }
  if (password.length < 8) {
    return c.json(
      { error: "Password must be at least 8 characters long" },
      400
    );
  }
  const id = crypto6.randomUUID();
  const passwordHash = hashPassword(password);
  try {
    await c.env.DB.prepare(
      `INSERT INTO email_accounts (id, email, password_hash, display_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(id, email, passwordHash, displayName || null).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") || msg.includes("unique")) {
      return c.json(
        { error: "An account with this email already exists. Try signing in." },
        409
      );
    }
    if (msg.includes("no such table")) {
      console.error("emailSignUp: missing tables \u2014 apply D1 migrations", e);
      return c.json(
        {
          error: "Database is missing email auth tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local)."
        },
        500
      );
    }
    console.error("emailSignUp insert error:", e);
    return c.json({ error: "Could not create account. Please try again." }, 500);
  }
  let rawToken;
  try {
    const session = await createEmailSession(c.env.DB, id);
    rawToken = session.rawToken;
  } catch (sessionErr) {
    console.error("emailSignUp session error:", sessionErr);
    await c.env.DB.prepare("DELETE FROM email_accounts WHERE id = ?").bind(id).run();
    const smsg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
    if (smsg.includes("no such table")) {
      return c.json(
        {
          error: "Database is missing email auth tables. Apply D1 migrations (e.g. npx wrangler d1 migrations apply momentum-db --local)."
        },
        500
      );
    }
    return c.json({ error: "Could not create session. Please try again." }, 500);
  }
  setEmailSessionCookie(c, rawToken);
  return c.json({ success: true, userId: id }, 201);
}
__name(emailSignUp, "emailSignUp");
async function emailPasswordSignIn(c) {
  const body = await c.req.json();
  const emailRaw = body.email;
  const password = body.password;
  if (!emailRaw || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }
  const row = await c.env.DB.prepare(
    "SELECT id, password_hash FROM email_accounts WHERE email = ?"
  ).bind(email).first();
  if (!row || !verifyPasswordStored(password, row.password_hash)) {
    return c.json({ error: "Invalid email or password" }, 401);
  }
  const { rawToken } = await createEmailSession(c.env.DB, row.id);
  setEmailSessionCookie(c, rawToken);
  return c.json({ success: true }, 200);
}
__name(emailPasswordSignIn, "emailPasswordSignIn");
var FORGOT_PASSWORD_OK_MESSAGE = "If an account exists for this email, we sent password reset instructions.";
async function requestPasswordReset(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const emailRaw = body.email;
  if (!emailRaw || typeof emailRaw !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }
  const email = normalizeEmail(emailRaw);
  if (!isValidEmail(email)) {
    return c.json({ error: "Please enter a valid email address" }, 400);
  }
  const row = await c.env.DB.prepare("SELECT id, email FROM email_accounts WHERE email = ?").bind(email).first();
  if (!row) {
    return c.json({ success: true, message: FORGOT_PASSWORD_OK_MESSAGE }, 200);
  }
  const rawToken = crypto6.randomBytes(32).toString("hex");
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  try {
    await c.env.DB.prepare("DELETE FROM email_password_resets WHERE user_id = ?").bind(row.id).run();
    await c.env.DB.prepare(
      `INSERT INTO email_password_resets (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`
    ).bind(row.id, tokenHash, expiresAt.toISOString()).run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table")) {
      console.error("requestPasswordReset: apply D1 migrations (email_password_resets)", e);
      return c.json(
        {
          error: "Database is missing password reset tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local)."
        },
        500
      );
    }
    console.error("requestPasswordReset:", e);
    return c.json({ error: "Could not process request. Try again later." }, 500);
  }
  const base = passwordResetAppBaseUrl(c, body.redirect_base);
  if (!base) {
    console.error("requestPasswordReset: could not determine app URL (Origin, redirect_base, or PUBLIC_APP_URL)");
    return c.json(
      { error: "Server could not build reset link. Set PUBLIC_APP_URL or send redirect_base." },
      500
    );
  }
  const resetUrl = `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  const from = typeof c.env.TRANSACTIONAL_EMAIL_FROM === "string" && c.env.TRANSACTIONAL_EMAIL_FROM.trim() ? c.env.TRANSACTIONAL_EMAIL_FROM.trim() : "Momentum <onboarding@resend.dev>";
  try {
    const hasResendKey = typeof c.env.RESEND_API_KEY === "string" && c.env.RESEND_API_KEY.trim() !== "";
    await sendPasswordResetEmail({
      apiKey: c.env.RESEND_API_KEY,
      from,
      to: row.email,
      resetUrl,
      logResetLinkForDev: isLocalDevHost(c) && !hasResendKey
    });
  } catch {
    return c.json({ error: "Could not send reset email. Try again later." }, 500);
  }
  return c.json({ success: true, message: FORGOT_PASSWORD_OK_MESSAGE }, 200);
}
__name(requestPasswordReset, "requestPasswordReset");
async function confirmPasswordReset(c) {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const tokenRaw = body.token;
  const password = body.password;
  if (!tokenRaw || typeof tokenRaw !== "string" || !password) {
    return c.json({ error: "Token and new password are required" }, 400);
  }
  if (password.length < 8) {
    return c.json(
      { error: "Password must be at least 8 characters long" },
      400
    );
  }
  const tokenHash = hashOpaqueToken(tokenRaw.trim());
  let userId;
  try {
    const resetRow = await c.env.DB.prepare(
      `SELECT user_id, expires_at FROM email_password_resets WHERE token_hash = ?`
    ).bind(tokenHash).first();
    if (!resetRow || new Date(resetRow.expires_at) <= /* @__PURE__ */ new Date()) {
      if (resetRow) {
        await c.env.DB.prepare("DELETE FROM email_password_resets WHERE token_hash = ?").bind(tokenHash).run();
      }
      return c.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        400
      );
    }
    userId = resetRow.user_id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table")) {
      return c.json(
        {
          error: "Database is missing password reset tables. Apply migrations (e.g. npx wrangler d1 migrations apply momentum-db --local)."
        },
        500
      );
    }
    console.error("confirmPasswordReset lookup:", e);
    return c.json({ error: "Could not verify reset token." }, 500);
  }
  const newHash = hashPassword(password);
  try {
    await c.env.DB.prepare(
      "UPDATE email_accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(newHash, userId).run();
    await c.env.DB.prepare("DELETE FROM email_password_resets WHERE user_id = ?").bind(userId).run();
    await revokeAllEmailSessionsForUser(c.env.DB, userId);
  } catch (e) {
    console.error("confirmPasswordReset:", e);
    return c.json({ error: "Could not update password. Try again." }, 500);
  }
  return c.json({ success: true }, 200);
}
__name(confirmPasswordReset, "confirmPasswordReset");

// src/worker/personalization-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();

// src/worker/clip-row-normalize.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function coercePositiveInt(v) {
  if (typeof v === "number" && Number.isFinite(v) && v > 0 && Number.isInteger(v)) {
    return v;
  }
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}
__name(coercePositiveInt, "coercePositiveInt");
function normalizeClipApiRows(rows) {
  return rows.map((row) => {
    const out = { ...row };
    const rowid = out._clipRowId;
    delete out._clipRowId;
    let id = coercePositiveInt(out.id);
    if (id == null) {
      id = coercePositiveInt(rowid);
    }
    if (id != null) {
      out.id = id;
    }
    return out;
  });
}
__name(normalizeClipApiRows, "normalizeClipApiRows");

// src/worker/personalization-endpoints.ts
async function updatePersonalization(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const {
      favorite_artists,
      home_location,
      home_latitude,
      home_longitude,
      location_radius_miles,
      personalization_enabled
    } = body;
    await c.env.DB.prepare(
      `UPDATE user_profiles 
       SET favorite_artists = ?,
           home_location = ?,
           home_latitude = ?,
           home_longitude = ?,
           location_radius_miles = ?,
           personalization_enabled = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE mocha_user_id = ?`
    ).bind(
      favorite_artists ? JSON.stringify(favorite_artists) : null,
      home_location || null,
      home_latitude || null,
      home_longitude || null,
      location_radius_miles || 50,
      personalization_enabled !== void 0 ? personalization_enabled ? 1 : 0 : 1,
      mochaUser.id
    ).run();
    return c.json({ success: true });
  } catch (error3) {
    console.error("Update personalization error:", error3);
    return c.json({ error: "Failed to update personalization settings" }, 500);
  }
}
__name(updatePersonalization, "updatePersonalization");
async function getPersonalizedFeed(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const page = parseInt(c.req.query("page") || "1");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
    const offset = (page - 1) * limit;
    const profile3 = await c.env.DB.prepare(
      `SELECT favorite_artists, home_latitude, home_longitude, location_radius_miles, personalization_enabled
       FROM user_profiles 
       WHERE mocha_user_id = ?`
    ).bind(mochaUser.id).first();
    if (!profile3 || !profile3.personalization_enabled) {
      return c.json({ clips: [], personalized: false });
    }
    const favoriteArtists = profile3.favorite_artists ? JSON.parse(profile3.favorite_artists) : [];
    const hasLocation = profile3.home_latitude && profile3.home_longitude;
    const radiusMiles = profile3.location_radius_miles || 50;
    let query = `
      SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar,
        CASE 
          WHEN clips.artist_name IN (${favoriteArtists.map(() => "?").join(",")}) THEN 10
          ELSE 0
        END as artist_score,
        CASE
          WHEN clips.created_at >= datetime('now', '-24 hours') THEN 3
          ELSE 0
        END as recency_score
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.is_hidden = 0 AND clips.is_draft = 0
    `;
    const bindings = [...favoriteArtists];
    if (hasLocation) {
      const lat = profile3.home_latitude;
      const lon = profile3.home_longitude;
      query = `
        SELECT 
          clips.rowid AS _clipRowId,
          clips.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar,
          CASE 
            WHEN clips.artist_name IN (${favoriteArtists.map(() => "?").join(",")}) THEN 10
            ELSE 0
          END as artist_score,
          CASE
            WHEN clips.geolocation_latitude IS NOT NULL AND clips.geolocation_longitude IS NOT NULL THEN
              CASE
                WHEN (
                  3959 * acos(
                    cos(radians(?)) * cos(radians(clips.geolocation_latitude)) * 
                    cos(radians(clips.geolocation_longitude) - radians(?)) + 
                    sin(radians(?)) * sin(radians(clips.geolocation_latitude))
                  )
                ) <= ? THEN 5
                ELSE 0
              END
            ELSE 0
          END as location_score,
          CASE
            WHEN clips.created_at >= datetime('now', '-24 hours') THEN 3
            ELSE 0
          END as recency_score
        FROM clips
        LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
        WHERE clips.is_hidden = 0 AND clips.is_draft = 0
      `;
      bindings.push(lat, lon, lat, radiusMiles);
    }
    query += `
      ORDER BY (artist_score + ${hasLocation ? "location_score +" : ""} recency_score) DESC, 
               clips.created_at DESC
      LIMIT ? OFFSET ?
    `;
    bindings.push(limit, offset);
    const clips = await c.env.DB.prepare(query).bind(...bindings).all();
    return c.json({
      clips: normalizeClipApiRows(clips.results || []),
      personalized: true,
      page,
      limit,
      hasMore: (clips.results || []).length === limit
    });
  } catch (error3) {
    console.error("Get personalized feed error:", error3);
    return c.json({ error: "Failed to get personalized feed" }, 500);
  }
}
__name(getPersonalizedFeed, "getPersonalizedFeed");
async function getPersonalizedConcerts(c) {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
    const profile3 = await c.env.DB.prepare(
      `SELECT favorite_artists, home_latitude, home_longitude, location_radius_miles, personalization_enabled
       FROM user_profiles 
       WHERE mocha_user_id = ?`
    ).bind(mochaUser.id).first();
    if (!profile3 || !profile3.personalization_enabled) {
      return c.json({ concerts: [], personalized: false });
    }
    const favoriteArtists = profile3.favorite_artists ? JSON.parse(profile3.favorite_artists) : [];
    if (favoriteArtists.length === 0) {
      return c.json({ concerts: [], personalized: true, message: "No favorite artists set" });
    }
    const concerts = await c.env.DB.prepare(
      `SELECT 
        artist_tour_dates.*,
        artists.name as artist_name,
        artists.image_url as artist_image,
        venues.name as venue_name,
        venues.location as venue_location
       FROM artist_tour_dates
       LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
       LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
       WHERE artists.name IN (${favoriteArtists.map(() => "?").join(",")})
       AND artist_tour_dates.date >= datetime('now')
       ORDER BY artist_tour_dates.date ASC
       LIMIT ?`
    ).bind(...favoriteArtists, limit).all();
    return c.json({
      concerts: concerts.results || [],
      personalized: true
    });
  } catch (error3) {
    console.error("Get personalized concerts error:", error3);
    return c.json({ error: "Failed to get personalized concerts" }, 500);
  }
}
__name(getPersonalizedConcerts, "getPersonalizedConcerts");
async function triggerPersonalizationNotifications(env2, clipOrConcert) {
  try {
    let usersToNotify = [];
    if (clipOrConcert.artist_name) {
      const users = await env2.DB.prepare(
        `SELECT mocha_user_id, favorite_artists 
         FROM user_profiles 
         WHERE personalization_enabled = 1
         AND favorite_artists IS NOT NULL`
      ).all();
      usersToNotify = (users.results || []).filter((user) => {
        try {
          const favorites = JSON.parse(user.favorite_artists);
          return favorites.includes(clipOrConcert.artist_name);
        } catch {
          return false;
        }
      });
    }
    for (const user of usersToNotify) {
      const contentType = clipOrConcert.type === "clip" ? "moment" : "concert";
      const content = `${clipOrConcert.artist_name} ${clipOrConcert.type === "clip" ? "posted a new moment" : "announced a show"}${clipOrConcert.venue_name ? ` at ${clipOrConcert.venue_name}` : ""}`;
      await env2.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
         VALUES (?, 'favorite_artist', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        user.mocha_user_id,
        content,
        clipOrConcert.type === "clip" ? clipOrConcert.id : null
      ).run();
    }
  } catch (error3) {
    console.error("Trigger personalization notifications error:", error3);
  }
}
__name(triggerPersonalizationNotifications, "triggerPersonalizationNotifications");

// src/worker/index.ts
init_rate_limiter();

// src/worker/performance-utils.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var PerformanceMonitor = class {
  static {
    __name(this, "PerformanceMonitor");
  }
  startTime;
  markers;
  constructor() {
    this.startTime = Date.now();
    this.markers = /* @__PURE__ */ new Map();
  }
  mark(name) {
    this.markers.set(name, Date.now() - this.startTime);
  }
  getMetrics() {
    return {
      totalTime: Date.now() - this.startTime,
      markers: Object.fromEntries(this.markers)
    };
  }
  setHeaders(c) {
    const metrics = this.getMetrics();
    c.header(
      "Server-Timing",
      Object.entries(metrics.markers).map(([name, time3]) => `${name};dur=${time3}`).join(", ")
    );
    c.header("X-Response-Time", `${metrics.totalTime}ms`);
  }
};

// src/worker/resumable-upload-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var uploadMetadata = /* @__PURE__ */ new Map();
async function handleResumableUpload(c) {
  const formData = await c.req.formData();
  const chunk = formData.get("chunk");
  const uploadId = formData.get("uploadId");
  const chunkIndex = parseInt(formData.get("chunkIndex") || "0");
  const totalChunks = parseInt(formData.get("totalChunks") || "1");
  const fileName = formData.get("fileName") || "video.mp4";
  const fileSize = parseInt(formData.get("fileSize") || "0");
  if (!chunk || !uploadId) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  let metadata = uploadMetadata.get(uploadId);
  if (!metadata) {
    metadata = {
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: /* @__PURE__ */ new Set()
    };
    uploadMetadata.set(uploadId, metadata);
  }
  try {
    const chunkKey = `uploads/temp/${uploadId}/chunk_${chunkIndex}`;
    await c.env.R2_BUCKET.put(chunkKey, chunk.stream());
    metadata.uploadedChunks.add(chunkIndex);
    if (metadata.uploadedChunks.size === totalChunks) {
      const chunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey2 = `uploads/temp/${uploadId}/chunk_${i}`;
        const chunkObject = await c.env.R2_BUCKET.get(chunkKey2);
        if (!chunkObject) {
          throw new Error(`Missing chunk ${i}`);
        }
        chunks.push(await chunkObject.arrayBuffer());
      }
      const combinedBlob = new Blob(chunks);
      const mochaUser = c.get("user");
      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const finalKey = `clips/${mochaUser?.id || "anonymous"}/video/${timestamp}_${sanitizedName}`;
      await c.env.R2_BUCKET.put(finalKey, combinedBlob.stream(), {
        httpMetadata: {
          contentType: "video/mp4"
        }
      });
      for (let i = 0; i < totalChunks; i++) {
        const chunkKey2 = `uploads/temp/${uploadId}/chunk_${i}`;
        await c.env.R2_BUCKET.delete(chunkKey2);
      }
      uploadMetadata.delete(uploadId);
      const publicUrl = `/api/files/${encodeURIComponent(finalKey)}`;
      return c.json({
        success: true,
        url: publicUrl,
        key: finalKey,
        size: fileSize,
        type: "video/mp4"
      }, 201);
    }
    return c.json({
      success: true,
      chunkIndex,
      uploadedChunks: metadata.uploadedChunks.size,
      totalChunks,
      complete: false
    });
  } catch (error3) {
    console.error("Resumable upload error:", error3);
    return c.json({ error: "Failed to process chunk" }, 500);
  }
}
__name(handleResumableUpload, "handleResumableUpload");

// src/worker/clip-endpoints.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function parsePositiveClipIdFromRequest(c) {
  for (const name of ["clipId", "id"]) {
    const raw2 = c.req.param(name);
    if (raw2 == null || String(raw2).trim() === "") continue;
    const n = Number.parseInt(String(raw2).trim(), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  try {
    const path = new URL(c.req.url).pathname.replace(/\/$/, "");
    const last = path.split("/").pop();
    if (last != null && /^\d+$/.test(last)) {
      return Number.parseInt(last, 10);
    }
  } catch {
  }
  return null;
}
__name(parsePositiveClipIdFromRequest, "parsePositiveClipIdFromRequest");
async function deleteOwnClip(c) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = parsePositiveClipIdFromRequest(c);
  if (clipId == null) {
    return c.json({ error: "Invalid clip id" }, 400);
  }
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  if (clip.mocha_user_id !== user.id) {
    return c.json({ error: "You can only delete clips you uploaded" }, 403);
  }
  await purgeClipFromDatabase(c.env.DB, clipId);
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(clipId);
  } catch (err) {
    console.error("deleteOwnClip broadcast:", err);
  }
  return c.json({ success: true }, 200);
}
__name(deleteOwnClip, "deleteOwnClip");

// src/worker/realtime-durable-object.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
import { DurableObject } from "cloudflare:workers";
var RealtimeDurableObject = class extends DurableObject {
  static {
    __name(this, "RealtimeDurableObject");
  }
  sessions;
  channels;
  constructor(ctx, env2) {
    super(ctx, env2);
    this.sessions = /* @__PURE__ */ new Map();
    this.channels = /* @__PURE__ */ new Map();
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }
    if (url.pathname === "/broadcast" && request.method === "POST") {
      return this.handleBroadcast(request);
    }
    if (url.pathname === "/channels" && request.method === "GET") {
      return this.handleChannelInfo();
    }
    return new Response("Not found", { status: 404 });
  }
  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const sessionId = url.searchParams.get("session_id") || crypto.randomUUID();
    const session = {
      webSocket: server,
      userId: userId || null,
      sessionId,
      subscriptions: /* @__PURE__ */ new Set()
    };
    this.sessions.set(server, session);
    server.addEventListener("message", (event) => {
      this.handleMessage(server, event.data);
    });
    server.addEventListener("close", () => {
      this.handleClose(server);
    });
    server.addEventListener("error", () => {
      this.handleClose(server);
    });
    server.send(JSON.stringify({
      type: "connected",
      sessionId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }));
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
  handleMessage(ws, data) {
    try {
      const session = this.sessions.get(ws);
      if (!session) return;
      const message = JSON.parse(data.toString());
      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(ws, session, message.channel);
          break;
        case "unsubscribe":
          this.handleUnsubscribe(ws, session, message.channel);
          break;
        case "ping":
          ws.send(JSON.stringify({ type: "pong", timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
          break;
        default:
          ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
      }
    } catch (error3) {
      console.error("Error handling message:", error3);
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  }
  handleSubscribe(ws, session, channel2) {
    if (!channel2) {
      ws.send(JSON.stringify({ type: "error", message: "Channel name required" }));
      return;
    }
    session.subscriptions.add(channel2);
    if (!this.channels.has(channel2)) {
      this.channels.set(channel2, /* @__PURE__ */ new Set());
    }
    this.channels.get(channel2).add(ws);
    ws.send(JSON.stringify({
      type: "subscribed",
      channel: channel2,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  handleUnsubscribe(ws, session, channel2) {
    if (!channel2) return;
    session.subscriptions.delete(channel2);
    const channelSessions = this.channels.get(channel2);
    if (channelSessions) {
      channelSessions.delete(ws);
      if (channelSessions.size === 0) {
        this.channels.delete(channel2);
      }
    }
    ws.send(JSON.stringify({
      type: "unsubscribed",
      channel: channel2,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }));
  }
  handleClose(ws) {
    const session = this.sessions.get(ws);
    if (!session) return;
    for (const channel2 of session.subscriptions) {
      const channelSessions = this.channels.get(channel2);
      if (channelSessions) {
        channelSessions.delete(ws);
        if (channelSessions.size === 0) {
          this.channels.delete(channel2);
        }
      }
    }
    this.sessions.delete(ws);
  }
  async handleBroadcast(request) {
    try {
      const message = await request.json();
      if (!message.type || !message.data) {
        return new Response("Invalid broadcast message", { status: 400 });
      }
      const channel2 = message.channel || "global";
      const channelSessions = this.channels.get(channel2);
      if (!channelSessions || channelSessions.size === 0) {
        return new Response(JSON.stringify({ delivered: 0 }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      const payload = JSON.stringify({
        type: message.type,
        data: message.data,
        channel: channel2,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      let delivered = 0;
      for (const ws of channelSessions) {
        try {
          ws.send(payload);
          delivered++;
        } catch (error3) {
          console.error("Error sending to websocket:", error3);
          this.handleClose(ws);
        }
      }
      return new Response(JSON.stringify({ delivered }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error3) {
      console.error("Error handling broadcast:", error3);
      return new Response("Internal server error", { status: 500 });
    }
  }
  async handleChannelInfo() {
    const info3 = {
      totalSessions: this.sessions.size,
      channels: Array.from(this.channels.entries()).map(([name, sessions]) => ({
        name,
        subscribers: sessions.size
      }))
    };
    return new Response(JSON.stringify(info3), {
      headers: { "Content-Type": "application/json" }
    });
  }
};

// src/worker/index.ts
var app = new Hono2();
app.use("/api/*", rateLimiter(RateLimits.GENERAL));
app.use("*", async (c, next) => {
  const monitor = new PerformanceMonitor();
  await next();
  monitor.setHeaders(c);
});
var ALLOWED_OAUTH_PROVIDERS = /* @__PURE__ */ new Set(["google", "spotify"]);
app.get("/api/oauth/:provider/redirect_url", async (c) => {
  const provider = c.req.param("provider");
  if (!ALLOWED_OAUTH_PROVIDERS.has(provider)) {
    return c.json({ error: "Unsupported OAuth provider" }, 400);
  }
  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return c.json(
      {
        error: "OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY in .dev.vars (local) or Worker secrets (Cloudflare)."
      },
      503
    );
  }
  const apiUrl = c.env.MOCHA_USERS_SERVICE_API_URL || DEFAULT_MOCHA_USERS_SERVICE_API_URL;
  const redirectBase = c.req.query("redirect_base")?.trim() || (typeof c.env.MOCHA_OAUTH_REDIRECT_ORIGIN === "string" ? c.env.MOCHA_OAUTH_REDIRECT_ORIGIN.trim() : "");
  const mochaParams = new URLSearchParams();
  if (redirectBase.length > 0) {
    mochaParams.set("redirect_base", redirectBase);
  }
  const qs2 = mochaParams.toString();
  const mochaRedirectUrl = `${apiUrl}/oauth/${provider}/redirect_url${qs2 ? `?${qs2}` : ""}`;
  const response = await fetch(mochaRedirectUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    }
  });
  if (!response.ok) {
    const errBody = await response.text();
    console.error("Mocha OAuth redirect error", provider, response.status, errBody);
    return c.json(
      {
        error: provider === "spotify" ? "Spotify sign-in is not available. Try Google or email, enable Spotify in your Mocha project, and allow this app origin as a redirect URL." : "Could not start Google sign-in. Check Mocha API URL and key, and register this app origin /auth/callback in your Mocha app settings."
      },
      502
    );
  }
  const data = await response.json();
  return c.json({ redirectUrl: data.redirect_url }, 200);
});
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();
  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }
  const apiKey = c.env.MOCHA_USERS_SERVICE_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return c.json(
      {
        error: "OAuth is not configured. Set MOCHA_USERS_SERVICE_API_KEY in .dev.vars or Worker secrets."
      },
      503
    );
  }
  let sessionToken;
  try {
    sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey
    });
  } catch (e) {
    console.error("exchangeCodeForSessionToken:", e);
    return c.json(
      {
        error: "Could not exchange OAuth code. Confirm Mocha credentials and that this deployment URL is allowed for OAuth return."
      },
      502
    );
  }
  const local = isLocalDevHost(c);
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: local ? "lax" : "none",
    secure: !local,
    maxAge: 30 * 24 * 60 * 60
    // 30 days
  });
  return c.json({ success: true }, 200);
});
app.get("/api/users/me", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const profile3 = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  return c.json({
    ...mochaUser,
    profile: profile3 || null
  });
});
app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY
    });
  }
  const localLogout = isLocalDevHost(c);
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: localLogout ? "lax" : "none",
    secure: !localLogout,
    maxAge: 0
  });
  const emailToken = getCookie(c, EMAIL_SESSION_COOKIE_NAME);
  if (typeof emailToken === "string" && emailToken.length > 0) {
    await revokeEmailSession(c.env.DB, emailToken);
  }
  clearEmailSessionCookie(c);
  return c.json({ success: true }, 200);
});
app.post(
  "/api/auth/signup",
  rateLimiter(RateLimits.AUTH),
  emailSignUp
);
app.post(
  "/api/auth/signin",
  rateLimiter(RateLimits.AUTH),
  emailPasswordSignIn
);
app.post(
  "/api/auth/forgot-password",
  rateLimiter(RateLimits.AUTH),
  requestPasswordReset
);
app.post(
  "/api/auth/reset-password",
  rateLimiter(RateLimits.AUTH),
  confirmPasswordReset
);
app.post("/api/auth/create-device-token", authMiddleware2, createDeviceToken);
app.post("/api/auth/verify-device-token", verifyDeviceToken);
app.get("/api/auth/device-tokens", authMiddleware2, getDeviceTokens);
app.delete("/api/auth/device-tokens/:tokenId", authMiddleware2, revokeDeviceToken);
app.delete("/api/auth/device-tokens", authMiddleware2, revokeAllDeviceTokens);
app.post("/api/personalization/update", authMiddleware2, updatePersonalization);
app.get("/api/feed/personalized", authMiddleware2, getPersonalizedFeed);
app.get("/api/personalization/concerts", authMiddleware2, getPersonalizedConcerts);
app.post("/api/users/verification-request", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const { full_name, reason, proof_url, social_links } = body;
  if (!full_name || !reason || !proof_url || !social_links) {
    return c.json({ error: "Missing required fields" }, 400);
  }
  const existingRequest = await c.env.DB.prepare(
    "SELECT id FROM verification_requests WHERE mocha_user_id = ? AND status = 'pending'"
  ).bind(mochaUser.id).first();
  if (existingRequest) {
    return c.json({ error: "You already have a pending verification request" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO verification_requests (mocha_user_id, full_name, reason, proof_url, social_links, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(mochaUser.id, full_name, reason, proof_url, social_links).run();
  return c.json({ success: true }, 201);
});
app.get("/api/admin/verification-requests", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const statusFilter = c.req.query("status") || "pending";
  let query = `
    SELECT 
      verification_requests.*,
      user_profiles.display_name,
      user_profiles.role,
      user_profiles.profile_image_url
    FROM verification_requests
    LEFT JOIN user_profiles ON verification_requests.mocha_user_id = user_profiles.mocha_user_id
  `;
  const bindings = [];
  if (statusFilter !== "all") {
    query += ` WHERE verification_requests.status = ?`;
    bindings.push(statusFilter);
  }
  query += ` ORDER BY verification_requests.created_at DESC LIMIT 100`;
  const requests = await c.env.DB.prepare(query).bind(...bindings).all();
  return c.json({ requests: requests.results || [] });
});
app.post("/api/admin/verification-requests/:requestId/review", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const requestId = c.req.param("requestId");
  const body = await c.req.json();
  const { action, rejection_reason } = body;
  if (!action || action !== "approve" && action !== "reject") {
    return c.json({ error: "Invalid action" }, 400);
  }
  const request = await c.env.DB.prepare(
    "SELECT mocha_user_id FROM verification_requests WHERE id = ?"
  ).bind(requestId).first();
  if (!request) {
    return c.json({ error: "Request not found" }, 404);
  }
  if (action === "approve") {
    await c.env.DB.prepare(
      "UPDATE user_profiles SET is_verified = 1, updated_at = CURRENT_TIMESTAMP WHERE mocha_user_id = ?"
    ).bind(request.mocha_user_id).run();
    await c.env.DB.prepare(
      `UPDATE verification_requests 
       SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(mochaUser.id, requestId).run();
    await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'verification', 'Your verification request has been approved! \u{1F389}', CURRENT_TIMESTAMP)`
    ).bind(request.mocha_user_id).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE verification_requests 
       SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(mochaUser.id, rejection_reason || null, requestId).run();
    await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, created_at)
       VALUES (?, 'verification', ?, CURRENT_TIMESTAMP)`
    ).bind(
      request.mocha_user_id,
      rejection_reason ? `Your verification request was not approved. Reason: ${rejection_reason}` : "Your verification request was not approved."
    ).run();
  }
  return c.json({ success: true });
});
app.post("/api/users/profile", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const nullIfUndef = /* @__PURE__ */ __name((v) => v === void 0 ? null : v, "nullIfUndef");
  try {
    const body = await c.req.json();
    const {
      role,
      display_name,
      bio,
      location,
      profile_image_url,
      cover_image_url,
      city,
      genres,
      social_links
    } = body;
    const roleVal = typeof role === "string" && role.trim() !== "" ? role : "fan";
    const genresJson = JSON.stringify(Array.isArray(genres) ? genres : []);
    const socialJson = JSON.stringify(
      social_links !== void 0 && social_links !== null && typeof social_links === "object" ? social_links : {}
    );
    const existingProfile = await c.env.DB.prepare(
      "SELECT id FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    if (existingProfile) {
      await c.env.DB.prepare(
        `UPDATE user_profiles 
       SET role = ?, display_name = ?, bio = ?, location = ?, 
           profile_image_url = ?, cover_image_url = ?, city = ?, 
           genres = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
       WHERE mocha_user_id = ?`
      ).bind(
        roleVal,
        nullIfUndef(display_name),
        nullIfUndef(bio),
        nullIfUndef(location),
        nullIfUndef(profile_image_url),
        nullIfUndef(cover_image_url),
        nullIfUndef(city),
        genresJson,
        socialJson,
        mochaUser.id
      ).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO user_profiles 
       (mocha_user_id, role, display_name, bio, location, profile_image_url, 
        cover_image_url, city, genres, social_links, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        mochaUser.id,
        roleVal,
        nullIfUndef(display_name),
        nullIfUndef(bio),
        nullIfUndef(location),
        nullIfUndef(profile_image_url),
        nullIfUndef(cover_image_url),
        nullIfUndef(city),
        genresJson,
        socialJson
      ).run();
    }
    const updatedProfile = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
    ).bind(mochaUser.id).first();
    return c.json(updatedProfile);
  } catch (e) {
    console.error("POST /api/users/profile:", e);
    return c.json({ error: "Could not save profile" }, 500);
  }
});
app.post("/api/upload/resumable", authMiddleware2, handleResumableUpload);
app.post("/api/upload", authMiddleware2, rateLimiter(RateLimits.UPLOAD), async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const formData = await c.req.formData();
  const file = formData.get("file");
  const type = formData.get("type");
  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }
  if (!type || type !== "video" && type !== "thumbnail") {
    return c.json({ error: "Invalid file type" }, 400);
  }
  try {
    if (type === "video") {
      try {
        const streamService = createStreamService(c.env);
        const videoDetails = await streamService.uploadVideo(file, {
          name: file.name
        });
        return c.json({
          success: true,
          streamVideoId: videoDetails.uid,
          playbackUrl: videoDetails.playbackUrl,
          thumbnailUrl: videoDetails.thumbnail,
          status: videoDetails.status,
          readyToStream: videoDetails.readyToStream,
          duration: videoDetails.duration,
          type: "stream"
        }, 201);
      } catch (streamError) {
        console.error("Stream upload failed, falling back to R2:", streamError);
      }
    }
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const key = `clips/${mochaUser.id}/${type}/${timestamp}_${sanitizedName}`;
    const contentType = file.type || (type === "video" ? "video/mp4" : "image/jpeg");
    await c.env.R2_BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType
      }
    });
    const publicUrl = `/api/files/${encodeURIComponent(key)}`;
    return c.json({
      success: true,
      url: publicUrl,
      key,
      size: file.size,
      type: contentType
    }, 201);
  } catch (error3) {
    console.error("Upload error:", error3);
    return c.json({ error: "Failed to upload file" }, 500);
  }
});
app.get("/api/files/:key{.+}", async (c) => {
  const key = decodeURIComponent(c.req.param("key"));
  try {
    const object = await c.env.R2_BUCKET.get(key);
    if (!object) {
      return c.json({ error: "File not found" }, 404);
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000");
    return c.body(object.body, { headers });
  } catch (error3) {
    console.error("File retrieval error:", error3);
    return c.json({ error: "Failed to retrieve file" }, 500);
  }
});
app.post("/api/clips", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json();
  const {
    artist_name,
    venue_name,
    location,
    timestamp,
    content_description,
    video_url,
    thumbnail_url,
    hashtags,
    stream_video_id,
    stream_playback_url,
    stream_thumbnail_url,
    video_status,
    video_duration,
    status,
    recording_orientation,
    video_resolution_w,
    video_resolution_h
  } = body;
  if (!video_url && !stream_video_id) {
    return c.json({ error: "video_url or stream_video_id is required" }, 400);
  }
  const {
    geolocation_latitude,
    geolocation_longitude,
    geolocation_accuracy_radius
  } = body;
  const result = await c.env.DB.prepare(
    `INSERT INTO clips 
     (mocha_user_id, artist_name, venue_name, location, timestamp, content_description, 
      video_url, thumbnail_url, hashtags, stream_video_id, stream_playback_url, 
      stream_thumbnail_url, video_status, video_duration, status, 
      geolocation_latitude, geolocation_longitude, geolocation_accuracy_radius, 
      recording_orientation, video_resolution_w, video_resolution_h,
      is_draft, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    mochaUser.id,
    artist_name || null,
    venue_name || null,
    location || null,
    timestamp || (/* @__PURE__ */ new Date()).toISOString(),
    content_description || null,
    video_url || null,
    thumbnail_url || null,
    JSON.stringify(hashtags || []),
    stream_video_id || null,
    stream_playback_url || null,
    stream_thumbnail_url || null,
    video_status || "ready",
    video_duration || null,
    status || "published",
    geolocation_latitude || null,
    geolocation_longitude || null,
    geolocation_accuracy_radius || null,
    recording_orientation || null,
    video_resolution_w || null,
    video_resolution_h || null,
    status === "draft" ? 1 : 0
  ).run();
  const newClip = await c.env.DB.prepare(
    "SELECT * FROM clips WHERE id = ?"
  ).bind(result.meta.last_row_id).first();
  try {
    await awardPoints(c.env, mochaUser.id, 10, "Uploaded a concert clip", result.meta.last_row_id);
  } catch (err) {
    console.error("Failed to award points:", err);
  }
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastFeedUpdate(result.meta.last_row_id);
  } catch (err) {
    console.error("Failed to broadcast feed update:", err);
  }
  if (artist_name || geolocation_latitude && geolocation_longitude) {
    try {
      await triggerPersonalizationNotifications(c.env, {
        id: result.meta.last_row_id,
        artist_name,
        venue_name,
        location,
        latitude: geolocation_latitude,
        longitude: geolocation_longitude,
        type: "clip"
      });
    } catch (err) {
      console.error("Failed to trigger personalization notifications:", err);
    }
  }
  return c.json(newClip, 201);
});
app.delete("/api/clips/:clipId", authMiddleware2, deleteOwnClip);
app.get("/api/clips", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 50);
  const sortBy = c.req.query("sort_by") || "latest";
  const artistName = c.req.query("artist_name");
  const venueName = c.req.query("venue_name");
  const userId = c.req.query("user_id");
  const since = c.req.query("since");
  const offset = (page - 1) * limit;
  let query = `
    SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      CASE WHEN live_featured_clips.id IS NOT NULL THEN 1 ELSE 0 END as momentum_live_featured
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN live_featured_clips ON clips.id = live_featured_clips.clip_id
    WHERE clips.is_hidden = 0
    AND clips.is_draft = 0
  `;
  const bindings = [];
  if (artistName) {
    query += ` AND clips.artist_name = ?`;
    bindings.push(artistName);
  }
  if (venueName) {
    query += ` AND clips.venue_name = ?`;
    bindings.push(venueName);
  }
  if (userId) {
    query += ` AND clips.mocha_user_id = ?`;
    bindings.push(userId);
  }
  if (since) {
    query += ` AND clips.created_at > ?`;
    bindings.push(since);
  }
  switch (sortBy) {
    case "trending":
      query += ` ORDER BY clips.is_trending_score DESC, clips.created_at DESC`;
      break;
    case "most_liked":
      query += ` ORDER BY clips.likes_count DESC, clips.created_at DESC`;
      break;
    case "most_viewed":
      query += ` ORDER BY clips.views_count DESC, clips.created_at DESC`;
      break;
    case "top_rated":
      query += ` ORDER BY clips.average_rating DESC, clips.rating_count DESC, clips.created_at DESC`;
      break;
    case "latest":
    default:
      query += ` ORDER BY clips.created_at DESC`;
      break;
  }
  query += ` LIMIT ? OFFSET ?`;
  bindings.push(limit, offset);
  const clips = await c.env.DB.prepare(query).bind(...bindings).all();
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  return c.json({
    clips: normalizeClipApiRows(clips.results || []),
    page,
    limit,
    hasMore: (clips.results || []).length === limit
  });
});
app.get("/api/clips/:id", async (c) => {
  const clipId = c.req.param("id");
  const clip = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.id = ?`
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  await c.env.DB.prepare(
    "UPDATE clips SET views_count = views_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(clipId).run();
  const [normalizedClip] = normalizeClipApiRows([clip]);
  return c.json(normalizedClip);
});
app.post("/api/clips/:id/like", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  const existingLike = await c.env.DB.prepare(
    "SELECT id FROM clip_likes WHERE clip_id = ? AND mocha_user_id = ?"
  ).bind(clipId, mochaUser.id).first();
  if (existingLike) {
    await c.env.DB.prepare(
      "DELETE FROM clip_likes WHERE clip_id = ? AND mocha_user_id = ?"
    ).bind(clipId, mochaUser.id).run();
    await c.env.DB.prepare(
      "UPDATE clips SET likes_count = likes_count - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(clipId).run();
    return c.json({ liked: false });
  } else {
    await c.env.DB.prepare(
      "INSERT INTO clip_likes (clip_id, mocha_user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    ).bind(clipId, mochaUser.id).run();
    await c.env.DB.prepare(
      "UPDATE clips SET likes_count = likes_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(clipId).run();
    try {
      await awardPoints(c.env, clip.mocha_user_id, 2, "Received a like", parseInt(clipId));
    } catch (err) {
      console.error("Failed to award points:", err);
    }
    try {
      await awardPoints(c.env, mochaUser.id, 1, "Liked a clip", parseInt(clipId));
    } catch (err) {
      console.error("Failed to award points:", err);
    }
    if (clip.mocha_user_id !== mochaUser.id) {
      const featured = await c.env.DB.prepare(
        `SELECT id FROM live_featured_clips WHERE clip_id = ? LIMIT 1`
      ).bind(clipId).first();
      const notificationContent = featured ? "liked your clip that was featured on Momentum Live" : "liked your clip";
      const notificationResult = await c.env.DB.prepare(
        `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, created_at)
         VALUES (?, 'like', ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        clip.mocha_user_id,
        notificationContent,
        mochaUser.id,
        clipId
      ).run();
      const notification = await c.env.DB.prepare(
        `SELECT 
          notifications.*,
          user_profiles.display_name as user_display_name,
          user_profiles.profile_image_url as user_avatar
        FROM notifications
        LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
        WHERE notifications.id = ?`
      ).bind(notificationResult.meta.last_row_id).first();
      try {
        const realtime = createRealtimeService(c.env);
        await realtime.broadcastNotification(clip.mocha_user_id, notification);
      } catch (err) {
        console.error("Failed to broadcast notification:", err);
      }
    }
    return c.json({ liked: true });
  }
});
app.post("/api/clips/:id/save", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  const clip = await c.env.DB.prepare(
    "SELECT id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  const existingSave = await c.env.DB.prepare(
    "SELECT id FROM saved_clips WHERE clip_id = ? AND mocha_user_id = ?"
  ).bind(clipId, mochaUser.id).first();
  if (existingSave) {
    await c.env.DB.prepare(
      "DELETE FROM saved_clips WHERE clip_id = ? AND mocha_user_id = ?"
    ).bind(clipId, mochaUser.id).run();
    return c.json({ saved: false });
  } else {
    await c.env.DB.prepare(
      "INSERT INTO saved_clips (clip_id, mocha_user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    ).bind(clipId, mochaUser.id).run();
    return c.json({ saved: true });
  }
});
app.get("/api/clips/:id/comments", async (c) => {
  const clipId = c.req.param("id");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const offset = parseInt(c.req.query("offset") || "0");
  const comments = await c.env.DB.prepare(
    `SELECT 
      comments.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM comments
    LEFT JOIN user_profiles ON comments.mocha_user_id = user_profiles.mocha_user_id
    WHERE comments.clip_id = ?
    ORDER BY comments.created_at DESC
    LIMIT ? OFFSET ?`
  ).bind(clipId, limit, offset).all();
  c.header("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
  return c.json({
    comments: comments.results || [],
    hasMore: (comments.results || []).length === limit
  });
});
app.post("/api/clips/:id/comments", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  const body = await c.req.json();
  const { content, parent_comment_id } = body;
  if (!content) {
    return c.json({ error: "Comment content is required" }, 400);
  }
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO comments (clip_id, mocha_user_id, parent_comment_id, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(clipId, mochaUser.id, parent_comment_id || null, content).run();
  await c.env.DB.prepare(
    "UPDATE clips SET comments_count = comments_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(clipId).run();
  if (clip.mocha_user_id !== mochaUser.id) {
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, related_comment_id, created_at)
       VALUES (?, 'comment', ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      clip.mocha_user_id,
      "commented on your clip",
      mochaUser.id,
      clipId,
      result.meta.last_row_id
    ).run();
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    ).bind(notificationResult.meta.last_row_id).first();
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(clip.mocha_user_id, notification);
    } catch (err) {
      console.error("Failed to broadcast notification:", err);
    }
  }
  try {
    await awardPoints(c.env, mochaUser.id, 3, "Posted a comment", parseInt(clipId), result.meta.last_row_id);
  } catch (err) {
    console.error("Failed to award points:", err);
  }
  const newComment = await c.env.DB.prepare(
    `SELECT 
      comments.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM comments
    LEFT JOIN user_profiles ON comments.mocha_user_id = user_profiles.mocha_user_id
    WHERE comments.id = ?`
  ).bind(result.meta.last_row_id).first();
  return c.json(newComment, 201);
});
app.post("/api/users/:userId/follow", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const targetUserId = c.req.param("userId");
  if (targetUserId === mochaUser.id) {
    return c.json({ error: "Cannot follow yourself" }, 400);
  }
  const existingFollow = await c.env.DB.prepare(
    "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?"
  ).bind(mochaUser.id, targetUserId).first();
  if (existingFollow) {
    await c.env.DB.prepare(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ?"
    ).bind(mochaUser.id, targetUserId).run();
    return c.json({ following: false });
  } else {
    await c.env.DB.prepare(
      "INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)"
    ).bind(mochaUser.id, targetUserId).run();
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, created_at)
       VALUES (?, 'follow', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(targetUserId, "started following you", mochaUser.id).run();
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    ).bind(notificationResult.meta.last_row_id).first();
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(targetUserId, notification);
    } catch (err) {
      console.error("Failed to broadcast notification:", err);
    }
    return c.json({ following: true });
  }
});
app.get("/api/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const profile3 = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(userId).first();
  if (!profile3) {
    return c.json({ error: "User not found" }, 404);
  }
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.mocha_user_id = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  ).bind(userId).all();
  const followerCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE following_id = ?"
  ).bind(userId).first();
  const followingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?"
  ).bind(userId).first();
  const totalLikes = clips.results?.reduce((sum, clip) => sum + (clip.likes_count || 0), 0) || 0;
  const totalViews = clips.results?.reduce((sum, clip) => sum + (clip.views_count || 0), 0) || 0;
  return c.json({
    profile: profile3,
    clips: normalizeClipApiRows(clips.results || []),
    stats: {
      totalClips: clips.results?.length || 0,
      totalLikes,
      totalViews,
      followers: followerCount?.count || 0,
      following: followingCount?.count || 0
    }
  });
});
app.get("/api/users/me/saved-clips", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const savedClips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM saved_clips
    JOIN clips ON saved_clips.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE saved_clips.mocha_user_id = ?
    ORDER BY saved_clips.created_at DESC`
  ).bind(mochaUser.id).all();
  return c.json({
    clips: normalizeClipApiRows(savedClips.results || [])
  });
});
app.get("/api/notifications", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const notifications = await c.env.DB.prepare(
    `SELECT 
      notifications.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM notifications
    LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
    WHERE notifications.mocha_user_id = ?
    ORDER BY notifications.is_read ASC, notifications.created_at DESC
    LIMIT 50`
  ).bind(mochaUser.id).all();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({ notifications: notifications.results || [] });
});
app.post("/api/notifications/:id/read", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const notificationId = c.req.param("id");
  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND mocha_user_id = ?"
  ).bind(notificationId, mochaUser.id).run();
  return c.json({ success: true });
});
app.post("/api/notifications/read-all", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE mocha_user_id = ? AND is_read = 0"
  ).bind(mochaUser.id).run();
  return c.json({ success: true });
});
app.get("/api/search/clips", rateLimiter(RateLimits.SEARCH), async (c) => {
  const query = c.req.query("q") || "";
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 50);
  if (!query || query.length < 2) {
    return c.json({ clips: [] });
  }
  const searchTerm = `%${query}%`;
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      -- Rank results by relevance
      CASE 
        WHEN clips.artist_name LIKE ? THEN 3
        WHEN clips.venue_name LIKE ? THEN 2
        ELSE 1
      END as relevance
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.is_hidden = 0
    AND (clips.artist_name LIKE ? 
       OR clips.venue_name LIKE ?
       OR clips.location LIKE ?
       OR clips.content_description LIKE ?)
    ORDER BY relevance DESC, clips.created_at DESC
    LIMIT ?`
  ).bind(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limit).all();
  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    clips: normalizeClipApiRows(clips.results || [])
  });
});
app.get("/api/search/advanced", advancedSearch);
app.get("/api/discover/trending", getTrendingContent);
app.get("/api/jambase/search/artists", searchArtists);
app.get("/api/jambase/search/venues", searchVenues);
app.get("/api/jambase/artist/:artistId/tourdates", getArtistTourDates);
app.get("/api/jambase/artist/:artistId", getArtistById);
app.get("/api/jambase/venue/:venueId", getVenueById);
app.get("/api/jambase/events/match", matchEventsByLocation);
app.get("/api/jambase/events/upcoming", getUpcomingEvents);
app.get("/api/artists/:artistName", async (c) => {
  const artistName = decodeURIComponent(c.req.param("artistName"));
  let artist = await c.env.DB.prepare(
    "SELECT * FROM artists WHERE name = ?"
  ).bind(artistName).first();
  if (!artist) {
    const result = await c.env.DB.prepare(
      "INSERT INTO artists (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(artistName).run();
    artist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
  }
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.artist_name = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  ).bind(artistName).all();
  const tourDates = await c.env.DB.prepare(
    `SELECT 
      artist_tour_dates.*,
      venues.name as venue_name,
      venues.location as venue_location
    FROM artist_tour_dates
    LEFT JOIN venues ON artist_tour_dates.venue_id = venues.id
    WHERE artist_tour_dates.artist_id = ?
    AND artist_tour_dates.date >= datetime('now')
    ORDER BY artist_tour_dates.date ASC`
  ).bind(artist?.id || 0).all();
  return c.json({
    artist,
    clips: normalizeClipApiRows(clips.results || []),
    tourDates: tourDates.results || []
  });
});
app.post("/api/artists", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "artist") {
    return c.json({ error: "Only artists can manage artist profiles" }, 403);
  }
  const body = await c.req.json();
  const { name, bio, image_url, social_links } = body;
  if (!name) {
    return c.json({ error: "Artist name is required" }, 400);
  }
  const existingArtist = await c.env.DB.prepare(
    "SELECT id FROM artists WHERE name = ?"
  ).bind(name).first();
  if (existingArtist) {
    await c.env.DB.prepare(
      `UPDATE artists 
       SET bio = ?, image_url = ?, social_links = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      bio || null,
      image_url || null,
      JSON.stringify(social_links || {}),
      existingArtist.id
    ).run();
    const updatedArtist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    ).bind(existingArtist.id).first();
    return c.json(updatedArtist);
  } else {
    const result = await c.env.DB.prepare(
      `INSERT INTO artists (name, bio, image_url, social_links, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      name,
      bio || null,
      image_url || null,
      JSON.stringify(social_links || {})
    ).run();
    const newArtist = await c.env.DB.prepare(
      "SELECT * FROM artists WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
    return c.json(newArtist, 201);
  }
});
app.get("/api/venues/:venueName", async (c) => {
  const venueName = decodeURIComponent(c.req.param("venueName"));
  let venue = await c.env.DB.prepare(
    "SELECT * FROM venues WHERE name = ?"
  ).bind(venueName).first();
  if (!venue) {
    const result = await c.env.DB.prepare(
      "INSERT INTO venues (name, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(venueName).run();
    venue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
  }
  const clips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.venue_name = ? AND clips.is_hidden = 0
    ORDER BY clips.created_at DESC
    LIMIT 50`
  ).bind(venueName).all();
  const upcomingEvents = await c.env.DB.prepare(
    `SELECT 
      artist_tour_dates.*,
      artists.name as artist_name,
      artists.image_url as artist_image
    FROM artist_tour_dates
    LEFT JOIN artists ON artist_tour_dates.artist_id = artists.id
    WHERE artist_tour_dates.venue_id = ?
    AND artist_tour_dates.date >= datetime('now')
    ORDER BY artist_tour_dates.date ASC`
  ).bind(venue?.id || 0).all();
  return c.json({
    venue,
    clips: normalizeClipApiRows(clips.results || []),
    upcomingEvents: upcomingEvents.results || []
  });
});
app.post("/api/venues", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "venue") {
    return c.json({ error: "Only venues can manage venue profiles" }, 403);
  }
  const body = await c.req.json();
  const { name, location, address, image_url, capacity } = body;
  if (!name) {
    return c.json({ error: "Venue name is required" }, 400);
  }
  const existingVenue = await c.env.DB.prepare(
    "SELECT id FROM venues WHERE name = ?"
  ).bind(name).first();
  if (existingVenue) {
    await c.env.DB.prepare(
      `UPDATE venues 
       SET location = ?, address = ?, image_url = ?, capacity = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      location || null,
      address || null,
      image_url || null,
      capacity || null,
      existingVenue.id
    ).run();
    const updatedVenue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    ).bind(existingVenue.id).first();
    return c.json(updatedVenue);
  } else {
    const result = await c.env.DB.prepare(
      `INSERT INTO venues (name, location, address, image_url, capacity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      name,
      location || null,
      address || null,
      image_url || null,
      capacity || null
    ).run();
    const newVenue = await c.env.DB.prepare(
      "SELECT * FROM venues WHERE id = ?"
    ).bind(result.meta.last_row_id).first();
    return c.json(newVenue, 201);
  }
});
app.post("/api/artists/:artistId/tour-dates", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT role FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || userProfile.role !== "artist") {
    return c.json({ error: "Only artists can add tour dates" }, 403);
  }
  const artistId = c.req.param("artistId");
  const body = await c.req.json();
  const { venue_id, date, city, country, ticket_url } = body;
  if (!date) {
    return c.json({ error: "Date is required" }, 400);
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO artist_tour_dates (artist_id, venue_id, date, city, country, ticket_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(
    artistId,
    venue_id || null,
    date,
    city || null,
    country || null,
    ticket_url || null
  ).run();
  const newTourDate = await c.env.DB.prepare(
    "SELECT * FROM artist_tour_dates WHERE id = ?"
  ).bind(result.meta.last_row_id).first();
  return c.json(newTourDate, 201);
});
app.get("/api/live/current", async (c) => {
  const session = await c.env.DB.prepare(
    `SELECT * FROM live_sessions 
     WHERE status IN ('live', 'scheduled')
     AND start_time <= datetime('now', '+30 minutes')
     ORDER BY start_time ASC
     LIMIT 1`
  ).first();
  if (!session) {
    return c.json({ session: null, currentClip: null, viewerCount: 0 });
  }
  let currentClip = null;
  if (session.status === "live" && session.current_clip_id) {
    const rawClip = await c.env.DB.prepare(
      `SELECT 
        clips.rowid AS _clipRowId,
        clips.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM clips
      LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
      WHERE clips.id = ?`
    ).bind(session.current_clip_id).first();
    if (rawClip) {
      const [n] = normalizeClipApiRows([rawClip]);
      currentClip = n;
    }
  }
  const viewerCount = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT mocha_user_id) as count 
     FROM live_session_viewers 
     WHERE live_session_id = ? 
     AND last_heartbeat >= datetime('now', '-30 seconds')`
  ).bind(session.id).first();
  return c.json({
    session,
    currentClip,
    viewerCount: viewerCount?.count || 0
  });
});
app.get("/api/live/schedule", async (c) => {
  const sessionId = c.req.query("session_id");
  if (!sessionId) {
    return c.json({ error: "session_id is required" }, 400);
  }
  const schedule = await c.env.DB.prepare(
    `SELECT 
      live_session_clips.*,
      clips.artist_name,
      clips.venue_name,
      clips.thumbnail_url,
      clips.content_description,
      user_profiles.display_name as user_display_name
    FROM live_session_clips
    LEFT JOIN clips ON live_session_clips.clip_id = clips.id
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_session_clips.live_session_id = ?
    ORDER BY live_session_clips.order_index ASC`
  ).bind(sessionId).all();
  return c.json({ schedule: schedule.results || [] });
});
app.get("/api/live/:sessionId/chat", async (c) => {
  const sessionId = c.req.param("sessionId");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);
  const since = c.req.query("since");
  let query = `
    SELECT 
      live_chat_messages.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM live_chat_messages
    LEFT JOIN user_profiles ON live_chat_messages.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_chat_messages.live_session_id = ?
    AND live_chat_messages.is_deleted = 0
  `;
  const bindings = [sessionId];
  if (since) {
    query += ` AND live_chat_messages.created_at > ?`;
    bindings.push(since);
  }
  query += ` ORDER BY live_chat_messages.created_at DESC LIMIT ?`;
  bindings.push(limit);
  const messages = await c.env.DB.prepare(query).bind(...bindings).all();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
  return c.json({
    messages: (messages.results || []).reverse()
    // Reverse to show oldest first
  });
});
app.post("/api/live/:sessionId/chat", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { content } = body;
  if (!content || !content.trim()) {
    return c.json({ error: "Message content is required" }, 400);
  }
  const session = await c.env.DB.prepare(
    "SELECT id, status FROM live_sessions WHERE id = ?"
  ).bind(sessionId).first();
  if (!session) {
    return c.json({ error: "Live session not found" }, 404);
  }
  if (session.status !== "live") {
    return c.json({ error: "Live session is not currently active" }, 400);
  }
  const ban = await c.env.DB.prepare(
    `SELECT id FROM live_chat_bans 
     WHERE live_session_id = ? 
     AND mocha_user_id = ?
     AND (expires_at IS NULL OR expires_at > datetime('now'))`
  ).bind(sessionId, mochaUser.id).first();
  if (ban) {
    return c.json({ error: "You are banned from this chat" }, 403);
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO live_chat_messages (live_session_id, mocha_user_id, content, created_at, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(sessionId, mochaUser.id, content.trim()).run();
  const newMessage = await c.env.DB.prepare(
    `SELECT 
      live_chat_messages.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM live_chat_messages
    LEFT JOIN user_profiles ON live_chat_messages.mocha_user_id = user_profiles.mocha_user_id
    WHERE live_chat_messages.id = ?`
  ).bind(result.meta.last_row_id).first();
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastChatMessage(parseInt(sessionId), newMessage);
  } catch (err) {
    console.error("Failed to broadcast chat message:", err);
  }
  return c.json(newMessage, 201);
});
app.post("/api/live/viewer-heartbeat", async (c) => {
  const body = await c.req.json();
  const { session_id, user_id } = body;
  if (!session_id) {
    return c.json({ error: "session_id is required" }, 400);
  }
  const userId = user_id || null;
  await c.env.DB.prepare(
    `INSERT INTO live_session_viewers (live_session_id, mocha_user_id, last_heartbeat, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(live_session_id, mocha_user_id) 
     DO UPDATE SET last_heartbeat = CURRENT_TIMESTAMP`
  ).bind(session_id, userId).run();
  await c.env.DB.prepare(
    `DELETE FROM live_session_viewers 
     WHERE last_heartbeat < datetime('now', '-1 minute')`
  ).run();
  const viewerCount = await c.env.DB.prepare(
    `SELECT COUNT(DISTINCT mocha_user_id) as count 
     FROM live_session_viewers 
     WHERE live_session_id = ? 
     AND last_heartbeat >= datetime('now', '-30 seconds')`
  ).bind(session_id).first();
  return c.json({
    success: true,
    viewerCount: viewerCount?.count || 0
  });
});
app.post("/api/admin/live/sessions", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const body = await c.req.json();
  const { start_time, end_time, title: title2, description } = body;
  if (!start_time || !end_time) {
    return c.json({ error: "start_time and end_time are required" }, 400);
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO live_sessions (start_time, end_time, title, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'scheduled', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(start_time, end_time, title2 || null, description || null).run();
  const newSession = await c.env.DB.prepare(
    "SELECT * FROM live_sessions WHERE id = ?"
  ).bind(result.meta.last_row_id).first();
  return c.json(newSession, 201);
});
app.put("/api/admin/live/sessions/:sessionId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { start_time, end_time, title: title2, description, status, current_clip_id } = body;
  await c.env.DB.prepare(
    `UPDATE live_sessions 
     SET start_time = COALESCE(?, start_time),
         end_time = COALESCE(?, end_time),
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         status = COALESCE(?, status),
         current_clip_id = COALESCE(?, current_clip_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(start_time || null, end_time || null, title2 || null, description || null, status || null, current_clip_id || null, sessionId).run();
  const updatedSession = await c.env.DB.prepare(
    "SELECT * FROM live_sessions WHERE id = ?"
  ).bind(sessionId).first();
  return c.json(updatedSession);
});
app.delete("/api/admin/live/sessions/:sessionId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  await c.env.DB.prepare("DELETE FROM live_session_clips WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_chat_messages WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_session_viewers WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_chat_bans WHERE live_session_id = ?").bind(sessionId).run();
  await c.env.DB.prepare("DELETE FROM live_sessions WHERE id = ?").bind(sessionId).run();
  return c.json({ success: true });
});
app.get("/api/admin/live/sessions", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessions = await c.env.DB.prepare(
    "SELECT * FROM live_sessions ORDER BY start_time DESC"
  ).all();
  return c.json({ sessions: sessions.results || [] });
});
app.post("/api/admin/live/sessions/:sessionId/clips", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { clip_id, order_index, duration } = body;
  if (!clip_id) {
    return c.json({ error: "clip_id is required" }, 400);
  }
  let finalOrderIndex = order_index;
  if (!finalOrderIndex) {
    const maxOrder = await c.env.DB.prepare(
      "SELECT MAX(order_index) as max_order FROM live_session_clips WHERE live_session_id = ?"
    ).bind(sessionId).first();
    finalOrderIndex = (maxOrder?.max_order || 0) + 1;
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO live_session_clips (live_session_id, clip_id, order_index, duration, created_at, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(sessionId, clip_id, finalOrderIndex, duration || null).run();
  const newScheduleItem = await c.env.DB.prepare(
    "SELECT * FROM live_session_clips WHERE id = ?"
  ).bind(result.meta.last_row_id).first();
  return c.json(newScheduleItem, 201);
});
app.delete("/api/admin/live/sessions/:sessionId/clips/:scheduleId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const scheduleId = c.req.param("scheduleId");
  await c.env.DB.prepare(
    "DELETE FROM live_session_clips WHERE id = ?"
  ).bind(scheduleId).run();
  return c.json({ success: true });
});
app.put("/api/admin/live/sessions/:sessionId/clips/reorder", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { clip_orders } = body;
  if (!clip_orders || !Array.isArray(clip_orders)) {
    return c.json({ error: "clip_orders array is required" }, 400);
  }
  for (const item of clip_orders) {
    await c.env.DB.prepare(
      "UPDATE live_session_clips SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND live_session_id = ?"
    ).bind(item.order_index, item.id, sessionId).run();
  }
  return c.json({ success: true });
});
app.delete("/api/admin/live/:sessionId/chat/:messageId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const messageId = c.req.param("messageId");
  await c.env.DB.prepare(
    `UPDATE live_chat_messages 
     SET is_deleted = 1, deleted_by = ?, deleted_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(mochaUser.id, messageId).run();
  return c.json({ success: true });
});
app.post("/api/admin/live/:sessionId/ban", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  const { user_id, reason, duration_minutes } = body;
  if (!user_id) {
    return c.json({ error: "user_id is required" }, 400);
  }
  let expiresAt = null;
  if (duration_minutes) {
    const expires = /* @__PURE__ */ new Date();
    expires.setMinutes(expires.getMinutes() + duration_minutes);
    expiresAt = expires.toISOString();
  }
  await c.env.DB.prepare(
    `INSERT INTO live_chat_bans (live_session_id, mocha_user_id, banned_by, reason, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(live_session_id, mocha_user_id) 
     DO UPDATE SET banned_by = ?, reason = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP`
  ).bind(sessionId, user_id, mochaUser.id, reason || null, expiresAt, mochaUser.id, reason || null, expiresAt).run();
  return c.json({ success: true });
});
app.delete("/api/admin/live/:sessionId/ban/:userId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const userId = c.req.param("userId");
  await c.env.DB.prepare(
    "DELETE FROM live_chat_bans WHERE live_session_id = ? AND mocha_user_id = ?"
  ).bind(sessionId, userId).run();
  return c.json({ success: true });
});
app.get("/api/admin/live/:sessionId/bans", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin, is_moderator FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin && !userProfile.is_moderator) {
    return c.json({ error: "Admin or moderator access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const bans = await c.env.DB.prepare(
    `SELECT 
      live_chat_bans.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar,
      moderator.display_name as banned_by_display_name
    FROM live_chat_bans
    LEFT JOIN user_profiles ON live_chat_bans.mocha_user_id = user_profiles.mocha_user_id
    LEFT JOIN user_profiles AS moderator ON live_chat_bans.banned_by = moderator.mocha_user_id
    WHERE live_chat_bans.live_session_id = ?
    AND (live_chat_bans.expires_at IS NULL OR live_chat_bans.expires_at > datetime('now'))
    ORDER BY live_chat_bans.created_at DESC`
  ).bind(sessionId).all();
  return c.json({ bans: bans.results || [] });
});
app.post("/api/clips/:id/share", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const clipId = c.req.param("id");
  const body = await c.req.json();
  const { platform: platform2 } = body;
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  await c.env.DB.prepare(
    `INSERT INTO clip_shares (clip_id, shared_by, platform, created_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).bind(clipId, mochaUser.id, platform2 || "unknown").run();
  try {
    await awardPoints(c.env, mochaUser.id, 5, "Shared a clip", parseInt(clipId));
  } catch (err) {
    console.error("Failed to award points:", err);
  }
  try {
    await awardPoints(c.env, clip.mocha_user_id, 3, "Clip was shared", parseInt(clipId));
  } catch (err) {
    console.error("Failed to award points:", err);
  }
  if (clip.mocha_user_id !== mochaUser.id) {
    const notificationResult = await c.env.DB.prepare(
      `INSERT INTO notifications (mocha_user_id, type, content, related_user_id, related_clip_id, created_at)
       VALUES (?, 'share', ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      clip.mocha_user_id,
      "shared your clip",
      mochaUser.id,
      clipId
    ).run();
    const notification = await c.env.DB.prepare(
      `SELECT 
        notifications.*,
        user_profiles.display_name as user_display_name,
        user_profiles.profile_image_url as user_avatar
      FROM notifications
      LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
      WHERE notifications.id = ?`
    ).bind(notificationResult.meta.last_row_id).first();
    try {
      const realtime = createRealtimeService(c.env);
      await realtime.broadcastNotification(clip.mocha_user_id, notification);
    } catch (err) {
      console.error("Failed to broadcast notification:", err);
    }
  }
  return c.json({ success: true });
});
app.post("/api/admin/live/sessions/:sessionId/feature-clip/:clipId", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const clipId = c.req.param("clipId");
  const clip = await c.env.DB.prepare(
    "SELECT id, mocha_user_id, artist_name FROM clips WHERE id = ?"
  ).bind(clipId).first();
  if (!clip) {
    return c.json({ error: "Clip not found" }, 404);
  }
  await c.env.DB.prepare(
    `INSERT INTO live_featured_clips (clip_id, live_session_id, featured_at, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(clipId, sessionId).run();
  const notificationResult = await c.env.DB.prepare(
    `INSERT INTO notifications (mocha_user_id, type, content, related_clip_id, created_at)
     VALUES (?, 'live', ?, ?, CURRENT_TIMESTAMP)`
  ).bind(
    clip.mocha_user_id,
    `\u{1F3AC} Your moment is on Momentum Live right now!`,
    clipId
  ).run();
  const notification = await c.env.DB.prepare(
    `SELECT 
      notifications.*,
      user_profiles.display_name as user_display_name,
      user_profiles.profile_image_url as user_avatar
    FROM notifications
    LEFT JOIN user_profiles ON notifications.related_user_id = user_profiles.mocha_user_id
    WHERE notifications.id = ?`
  ).bind(notificationResult.meta.last_row_id).first();
  try {
    const realtime = createRealtimeService(c.env);
    await realtime.broadcastNotification(clip.mocha_user_id, notification);
  } catch (err) {
    console.error("Failed to broadcast notification:", err);
  }
  try {
    await awardPoints(c.env, clip.mocha_user_id, 100, "Featured on Momentum Live", parseInt(clipId));
  } catch (err) {
    console.error("Failed to award points:", err);
  }
  return c.json({ success: true });
});
app.post("/api/admin/live/sessions/:sessionId/advance", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const sessionId = c.req.param("sessionId");
  const session = await c.env.DB.prepare(
    "SELECT id, current_clip_id FROM live_sessions WHERE id = ? AND status = 'live'"
  ).bind(sessionId).first();
  if (!session) {
    return c.json({ error: "Live session not found or not active" }, 404);
  }
  if (session.current_clip_id) {
    await c.env.DB.prepare(
      `UPDATE live_session_clips 
       SET played_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE live_session_id = ? AND clip_id = ?`
    ).bind(sessionId, session.current_clip_id).run();
  }
  const nextClip = await c.env.DB.prepare(
    `SELECT id, clip_id 
     FROM live_session_clips 
     WHERE live_session_id = ? AND played_at IS NULL 
     ORDER BY order_index ASC 
     LIMIT 1`
  ).bind(sessionId).first();
  if (!nextClip) {
    await c.env.DB.prepare(
      `UPDATE live_sessions 
       SET status = 'ended', current_clip_id = NULL, current_clip_started_at = NULL, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(sessionId).run();
    return c.json({ message: "Session ended - no more clips" });
  }
  await c.env.DB.prepare(
    `UPDATE live_sessions 
     SET current_clip_id = ?, current_clip_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(nextClip.clip_id, sessionId).run();
  return c.json({ success: true, nextClipId: nextClip.clip_id });
});
app.put("/api/admin/live/sessions/:sessionId/clips/:scheduleId/duration", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const scheduleId = c.req.param("scheduleId");
  const body = await c.req.json();
  const { duration } = body;
  if (typeof duration !== "number" || duration <= 0) {
    return c.json({ error: "Valid duration in seconds is required" }, 400);
  }
  await c.env.DB.prepare(
    `UPDATE live_session_clips 
     SET duration = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`
  ).bind(duration, scheduleId).run();
  return c.json({ success: true });
});
app.get("/api/admin/analytics", authMiddleware2, async (c) => {
  const mochaUser = c.get("user");
  if (!mochaUser) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const userProfile = await c.env.DB.prepare(
    "SELECT is_admin FROM user_profiles WHERE mocha_user_id = ?"
  ).bind(mochaUser.id).first();
  if (!userProfile || !userProfile.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }
  const range = c.req.query("range") || "30d";
  let daysBack = 30;
  switch (range) {
    case "7d":
      daysBack = 7;
      break;
    case "90d":
      daysBack = 90;
      break;
    default:
      daysBack = 30;
  }
  const totalUsers = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM user_profiles"
  ).first();
  const totalClips = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM clips"
  ).first();
  const totalViewsLikes = await c.env.DB.prepare(
    "SELECT SUM(views_count) as views, SUM(likes_count) as likes FROM clips"
  ).first();
  const activeSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions WHERE status = 'live'"
  ).first();
  const totalSessions = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM live_sessions"
  ).first();
  const growthData = await c.env.DB.prepare(
    `WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-' || ? || ' days')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    )
    SELECT 
      dates.date,
      COALESCE(COUNT(DISTINCT user_profiles.id), 0) as users,
      COALESCE(COUNT(DISTINCT clips.id), 0) as clips,
      COALESCE(SUM(clips.views_count), 0) as views
    FROM dates
    LEFT JOIN user_profiles ON date(user_profiles.created_at) = dates.date
    LEFT JOIN clips ON date(clips.created_at) = dates.date
    GROUP BY dates.date
    ORDER BY dates.date ASC`
  ).bind(daysBack).all();
  const topClips = await c.env.DB.prepare(
    `SELECT 
      clips.rowid AS _clipRowId,
      clips.*,
      user_profiles.display_name as user_display_name
    FROM clips
    LEFT JOIN user_profiles ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    ORDER BY (clips.likes_count * 3 + clips.views_count * 0.1 + clips.comments_count * 5) DESC
    LIMIT 10`
  ).bind(daysBack).all();
  const topUsers = await c.env.DB.prepare(
    `SELECT 
      user_profiles.mocha_user_id,
      user_profiles.display_name,
      user_profiles.profile_image_url,
      COUNT(clips.id) as total_clips,
      SUM(clips.likes_count) as total_likes,
      SUM(clips.views_count) as total_views
    FROM user_profiles
    JOIN clips ON clips.mocha_user_id = user_profiles.mocha_user_id
    WHERE clips.created_at >= date('now', '-' || ? || ' days')
    GROUP BY user_profiles.mocha_user_id
    ORDER BY total_clips DESC, total_likes DESC
    LIMIT 10`
  ).bind(daysBack).all();
  return c.json({
    platformStats: {
      totalUsers: totalUsers?.count || 0,
      totalClips: totalClips?.count || 0,
      totalViews: totalViewsLikes?.views || 0,
      totalLikes: totalViewsLikes?.likes || 0,
      activeSessions: activeSessions?.count || 0,
      totalSessions: totalSessions?.count || 0
    },
    growthData: growthData.results || [],
    topClips: normalizeClipApiRows(topClips.results || []),
    topUsers: topUsers.results || []
  });
});
app.post("/api/clips/:clipId/report", authMiddleware2, reportClip);
app.get("/api/admin/moderation/clips", authMiddleware2, getFlaggedClips);
app.post("/api/admin/moderation/clips/:flagId/review", authMiddleware2, reviewFlaggedClip);
app.delete("/api/admin/clips/:clipId", authMiddleware2, deleteClip);
app.get("/api/admin/moderation/users", authMiddleware2, getFlaggedUsers);
app.post("/api/admin/users/:userId/ban", authMiddleware2, banUser);
app.post("/api/admin/users/:userId/unban", authMiddleware2, unbanUser);
app.post("/api/stripe/checkout/premium", authMiddleware2, createPremiumCheckoutSession);
app.post("/api/stripe/checkout/tickets", authMiddleware2, createAffiliateCheckoutSession);
app.get("/api/stripe/subscription", authMiddleware2, getSubscriptionStatus);
app.post("/api/stripe/subscription/cancel", authMiddleware2, cancelSubscription);
app.get("/api/stripe/earnings", authMiddleware2, getEarnings);
app.post("/api/stripe/payout/request", authMiddleware2, requestPayout);
app.post("/api/stripe/connect/account-link", authMiddleware2, createConnectAccountLink);
app.get("/api/admin/stripe/payouts", authMiddleware2, getPendingPayouts);
app.post("/api/admin/stripe/payouts/:payoutId/process", authMiddleware2, processPayout);
app.post("/api/stripe/webhook", handleStripeWebhook);
app.get("/realtime", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const id = c.env.REALTIME.idFromName("global");
  const stub = c.env.REALTIME.get(id);
  return stub.fetch(c.req.raw);
});
app.post("/api/auth/2fa/setup", authMiddleware2, setupTwoFactor);
app.post("/api/auth/2fa/verify-enable", authMiddleware2, verifyAndEnableTwoFactor);
app.post("/api/auth/2fa/disable", authMiddleware2, disableTwoFactor);
app.get("/api/auth/2fa/status", authMiddleware2, getTwoFactorStatus);
app.post("/api/auth/2fa/verify-login", authMiddleware2, verifyTwoFactorLogin);
app.post("/api/stream/upload-from-url", authMiddleware2, uploadFromUrl);
app.get("/api/stream/video/:videoId/status", getVideoStatus);
app.delete("/api/stream/video/:videoId", authMiddleware2, deleteVideo);
app.get("/api/stream/video/:videoId/thumbnail", getThumbnail);
app.get("/api/analytics/platform", authMiddleware2, getPlatformAnalytics);
app.get("/api/analytics/user", authMiddleware2, getUserAnalytics);
app.get("/api/analytics/ambassador", authMiddleware2, getAmbassadorAnalytics);
app.get("/api/analytics/trends", getTrendAnalysis);
app.get("/api/analytics/clip/:clipId", getClipAnalytics);
app.post("/api/analytics/profile-view/:userId", trackProfileView);
app.post("/api/analytics/clip-share", authMiddleware2, trackClipShare);
app.post("/api/collaborations", authMiddleware2, createCollaborationRequest);
app.get("/api/collaborations", authMiddleware2, getCollaborationRequests);
app.post("/api/collaborations/:requestId/accept", authMiddleware2, acceptCollaborationRequest);
app.post("/api/collaborations/:requestId/reject", authMiddleware2, rejectCollaborationRequest);
app.post("/api/artists/me/pinned-clips/:clipId", authMiddleware2, pinClipToArtist);
app.delete("/api/artists/me/pinned-clips/:clipId", authMiddleware2, unpinClipFromArtist);
app.get("/api/artists/me/pinned-clips", authMiddleware2, getPinnedClips);
app.get("/api/gamification/points", authMiddleware2, getUserPoints);
app.get("/api/gamification/badges", authMiddleware2, getUserBadges);
app.get("/api/gamification/leaderboard", getLeaderboard);
app.post("/api/admin/gamification/badges/initialize", authMiddleware2, initializeDefaultBadges);
app.post("/api/live/:sessionId/polls", authMiddleware2, createLivePoll);
app.post("/api/live/polls/:pollId/vote", voteOnPoll);
app.get("/api/live/polls/:pollId/results", getLivePollResults);
app.get("/api/live/:sessionId/polls/active", getActivePoll);
app.post("/api/live/polls/:pollId/end", authMiddleware2, endLivePoll);
app.get("/api/gdpr/export", authMiddleware2, exportUserData);
app.post("/api/gdpr/delete-request", authMiddleware2, rateLimiter(RateLimits.STRICT), requestAccountDeletion);
app.get("/api/privacy/settings", authMiddleware2, getPrivacySettings);
app.post("/api/privacy/settings", authMiddleware2, updatePrivacySettings);
app.get("/api/admin/gdpr/deletion-requests", authMiddleware2, getDeletionRequests);
app.post("/api/admin/gdpr/deletion-requests/:requestId/process", authMiddleware2, processAccountDeletion);
app.get("/api/ticketmaster/events/search", rateLimiter(RateLimits.SEARCH), searchEvents);
app.get("/api/ticketmaster/events/:eventId", getEventById);
app.get("/api/ticketmaster/venues/:venueId", getVenueById2);
app.get("/api/ticketmaster/attractions/search", rateLimiter(RateLimits.SEARCH), searchAttractions);
app.post("/api/ticketmaster/purchase", authMiddleware2, createTicketPurchase);
app.get("/api/maps/geocode", rateLimiter(RateLimits.API), geocodeAddress);
app.get("/api/maps/reverse-geocode", rateLimiter(RateLimits.API), reverseGeocode);
app.get("/api/maps/nearby-venues", rateLimiter(RateLimits.SEARCH), searchNearbyVenues);
app.get("/api/maps/place-details", rateLimiter(RateLimits.API), getPlaceDetails);
app.get("/api/maps/distance", rateLimiter(RateLimits.API), calculateDistance);
app.get("/api/maps/autocomplete", rateLimiter(RateLimits.SEARCH), autocompleteVenue);
app.post("/api/clips/:id/rate", authMiddleware2, rateClip);
app.get("/api/clips/:id/rating", authMiddleware2, getUserClipRating);
app.get("/api/users/me/favorite-artists", authMiddleware2, getFavoriteArtists);
app.post("/api/users/favorite-artist", authMiddleware2, toggleFavoriteArtist);
app.post("/api/clips/:id/favorite", authMiddleware2, favoriteClip);
app.get("/api/clips/:id/favorited", authMiddleware2, checkClipFavorited);
app.get("/api/users/me/favorite-clips-by-artist", authMiddleware2, getFavoriteClipsByArtist);
app.get("/api/users/:userId/stats", getUserStats2);
app.get("/api/users/:userId/favorite-artists-with-clips", getUserFavoriteArtistsWithClips);
app.get("/api/discover/prioritized-shows", getPrioritizedShows);
app.get("/api/artists/:artistName/shows/:showId/clips", getShowClips);
app.get("/api/venues/:venueName/archive", getVenueArchive);
app.get("/api/artists/:artistName/live-status", async (c) => {
  const artistName = decodeURIComponent(c.req.param("artistName"));
  try {
    const liveSession = await c.env.DB.prepare(
      `SELECT 
        live_sessions.id as session_id,
        clips.venue_name,
        clips.location as venue_location,
        COUNT(DISTINCT clips.id) as moments_count,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM live_sessions
      LEFT JOIN live_session_clips ON live_sessions.id = live_session_clips.live_session_id
      LEFT JOIN clips ON live_session_clips.clip_id = clips.id
      WHERE live_sessions.status = 'live'
      AND clips.artist_name = ?
      AND clips.created_at >= datetime('now', '-2 hours')
      GROUP BY live_sessions.id, clips.venue_name, clips.location
      LIMIT 1`
    ).bind(artistName).first();
    if (liveSession) {
      return c.json({
        isLive: true,
        liveShow: liveSession
      });
    }
    return c.json({ isLive: false });
  } catch (error3) {
    console.error("Get artist live status error:", error3);
    return c.json({ error: "Failed to get live status" }, 500);
  }
});
app.get("/api/artists/:artistName/previous-shows", async (c) => {
  const artistName = decodeURIComponent(c.req.param("artistName"));
  const limit = Math.min(parseInt(c.req.query("limit") || "8"), 20);
  try {
    const previousShows = await c.env.DB.prepare(
      `SELECT 
        clips.show_id,
        clips.artist_name,
        MIN(clips.timestamp) as show_date,
        clips.venue_name,
        COUNT(DISTINCT clips.id) as clip_count,
        AVG(clips.average_rating) as average_show_rating,
        MAX(clips.thumbnail_url) as thumbnail_url
      FROM clips
      WHERE clips.artist_name = ?
      AND clips.is_hidden = 0
      AND clips.show_id IS NOT NULL
      GROUP BY clips.show_id, clips.artist_name, clips.venue_name
      ORDER BY show_date DESC
      LIMIT ?`
    ).bind(artistName, limit).all();
    return c.json({ shows: previousShows.results || [] });
  } catch (error3) {
    console.error("Get artist previous shows error:", error3);
    return c.json({ error: "Failed to get previous shows" }, 500);
  }
});
var worker_default = {
  fetch: app.fetch,
  scheduled: /* @__PURE__ */ __name(async (_event, env2, ctx) => {
    ctx.waitUntil(handleScheduled(env2));
  }, "scheduled")
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RhNPMN/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_process();
init_virtual_unenv_global_polyfill_cloudflare_unenv_preset_node_console();
init_performance2();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RhNPMN/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  RealtimeDurableObject,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
