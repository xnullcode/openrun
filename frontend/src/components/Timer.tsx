import { useState, useEffect, useRef } from 'react';
import { Timer as TimerIcon, Play, Pause, RotateCcw, ChevronLeft, Clock, Square } from 'lucide-react';

export default function Timer() {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0); // for stopwatch
  const [timeRemaining, setTimeRemaining] = useState(0); // for timer
  const [showPopover, setShowPopover] = useState(false);
  const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');
  const [timerHours, setTimerHours] = useState('00');
  const [timerMinutes, setTimerMinutes] = useState('00');
  const [initialTimerDuration, setInitialTimerDuration] = useState(0);
  
  const popoverRef = useRef<HTMLDivElement>(null);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const beep = (time: number, freq: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.start(time);
        osc.stop(time + dur);
      };
      // Play a triple beep pattern
      beep(ctx.currentTime, 880, 0.15);
      beep(ctx.currentTime + 0.25, 880, 0.15);
      beep(ctx.currentTime + 0.5, 880, 0.15);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        if (mode === 'stopwatch') {
          setTimeElapsed(prev => prev + 1);
        } else {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              setIsPaused(true);
              playBeep();
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, mode]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isActive && !isPaused) {
        e.preventDefault();
        e.returnValue = "You have an active timer running. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isActive, isPaused]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (mode === 'timer') {
      const h = parseInt(timerHours) || 0;
      const m = parseInt(timerMinutes) || 0;
      if (h === 0 && m === 0) return;
      const duration = h * 3600 + m * 60;
      setTimeRemaining(duration);
      setInitialTimerDuration(duration);
    } else {
      setTimeElapsed(0);
    }
    setIsActive(true);
    setIsPaused(false);
    setShowPopover(false);
  };

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
  };

  const handleReset = () => {
    if (mode === 'stopwatch') {
      setTimeElapsed(0);
    } else {
      const h = parseInt(timerHours) || 0;
      const m = parseInt(timerMinutes) || 0;
      const duration = h * 3600 + m * 60;
      setTimeRemaining(duration);
      setInitialTimerDuration(duration);
    }
    setIsPaused(true);
  };

  const handleClose = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimeElapsed(0);
    setTimeRemaining(0);
    setInitialTimerDuration(0);
    setShowPopover(false);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setTimerHours(val);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    if (parseInt(val) > 59) val = '59';
    setTimerMinutes(val);
  };

  const isTimer = mode === 'timer';
  const displayTime = isTimer ? timeRemaining : timeElapsed;
  
  const isWarning = isTimer && initialTimerDuration > 0 && timeRemaining <= initialTimerDuration * 0.1;
  const bgColor = isWarning ? 'bg-red-600 border-red-500' : 'bg-surface border-border';
  const textColor = isWarning ? 'text-white' : (isTimer ? 'text-orange-500' : 'text-primary');

  return (
    <div className="relative" ref={popoverRef}>
      {isActive ? (
        <div className={`group flex items-center ${bgColor} px-2 py-1.5 rounded-lg text-sm ${isWarning ? 'text-white/80' : 'text-textMuted'} transition-all border h-9 shadow-sm cursor-default`}>
          <div className="flex items-center overflow-hidden transition-all duration-300 ease-in-out w-0 opacity-0 group-hover:w-[44px] group-hover:opacity-100">
            <button onClick={handleClose} className="hover:text-white transition-colors flex-shrink-0 w-[22px] flex items-center justify-center" title="Close Timer">
              <ChevronLeft size={16} />
            </button>
            <button onClick={handlePauseToggle} className="hover:text-white transition-colors flex-shrink-0 w-[22px] flex items-center justify-center" title={isPaused ? "Play" : "Pause"}>
              {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
          </div>
          
          <button 
            onClick={() => setShowPopover(!showPopover)} 
            className={`tabular-nums text-sm ${textColor} font-semibold min-w-[42px] text-center select-none hover:opacity-80 transition-opacity mx-1`}
            title="Open Timer Settings"
          >
            {formatTime(displayTime)}
          </button>

          <div className="flex items-center overflow-hidden transition-all duration-300 ease-in-out w-0 opacity-0 group-hover:w-[22px] group-hover:opacity-100">
            <button onClick={handleReset} className="hover:text-white transition-colors flex-shrink-0 w-[22px] flex items-center justify-center" title="Reset">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowPopover(!showPopover)}
          className={`p-2 rounded-lg transition-colors h-9 w-9 flex items-center justify-center ${showPopover ? 'bg-secondary text-primary' : 'text-textMuted hover:text-primary hover:bg-secondary'}`}
          title="Open Timer"
        >
          <TimerIcon size={18} />
        </button>
      )}

      {showPopover && (
        <div className="absolute top-12 right-0 bg-surface border border-border rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[280px]">
          <div className="flex gap-2 mb-3 h-[120px]">
            {mode === 'stopwatch' ? (
              <>
                <button className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-blue-500 bg-blue-500/10 transition-colors h-full">
                  <TimerIcon size={24} className="text-blue-500" />
                  <span className="text-xs font-medium text-white">Stopwatch</span>
                </button>
                <button onClick={() => setMode('timer')} className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border hover:bg-secondary transition-colors h-full">
                  <Clock size={24} className="text-orange-500" />
                  <span className="text-xs font-medium text-gray-400">Timer</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setMode('stopwatch')} className="w-16 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-border hover:bg-secondary transition-colors h-full">
                  <TimerIcon size={24} className="text-blue-500" />
                </button>
                <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-orange-500 bg-orange-500/10 h-full">
                  <Clock size={20} className="text-orange-500" />
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={timerHours} 
                        onChange={handleHourChange} 
                        className="w-11 h-9 bg-transparent border border-border rounded-lg text-center text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        onBlur={() => setTimerHours(prev => (prev || '0').padStart(2, '0'))}
                      />
                      <span className="text-xs text-gray-400">hr</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={timerMinutes} 
                        onChange={handleMinuteChange} 
                        className="w-11 h-9 bg-transparent border border-border rounded-lg text-center text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        onBlur={() => setTimerMinutes(prev => (prev || '0').padStart(2, '0'))}
                      />
                      <span className="text-xs text-gray-400">min</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {isActive ? (
            <button 
              onClick={handleClose}
              className="w-full bg-secondary hover:bg-border text-red-500 font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-border"
            >
              <Square size={14} fill="currentColor" />
              {mode === 'stopwatch' ? 'End Stopwatch' : 'End Timer'}
            </button>
          ) : (
            <button 
              onClick={handleStart}
              disabled={mode === 'timer' && parseInt(timerHours || '0') === 0 && parseInt(timerMinutes || '0') === 0}
              className="w-full bg-textMain hover:bg-white disabled:opacity-50 disabled:hover:bg-textMain text-background font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Play size={16} fill="currentColor" />
              {mode === 'stopwatch' ? 'Start Stopwatch' : 'Start Timer'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
