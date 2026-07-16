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
  
  const popoverRef = useRef<HTMLDivElement>(null);

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
      setTimeRemaining(h * 3600 + m * 60);
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
      setTimeRemaining(h * 3600 + m * 60);
    }
    setIsPaused(true);
  };

  const handleClose = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimeElapsed(0);
    setTimeRemaining(0);
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
  const textColor = isTimer ? 'text-orange-500' : 'text-blue-400';

  return (
    <div className="relative" ref={popoverRef}>
      {isActive ? (
        <div className="flex items-center gap-1.5 bg-[#2b2b2b] px-2 py-1.5 rounded-lg text-sm text-textMuted transition-colors border border-border h-9 shadow-sm">
          <button onClick={handleClose} className="hover:text-white transition-colors" title="Close Timer">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handlePauseToggle} className="hover:text-white transition-colors" title={isPaused ? "Play" : "Pause"}>
            {isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
          </button>
          <button 
            onClick={() => setShowPopover(!showPopover)} 
            className={`tabular-nums text-[13px] ${textColor} font-medium min-w-[40px] text-center select-none hover:opacity-80 transition-opacity mx-0.5`}
            title="Open Timer Settings"
          >
            {formatTime(displayTime)}
          </button>
          <button onClick={handleReset} className="hover:text-white transition-colors" title="Reset">
            <RotateCcw size={14} />
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setShowPopover(!showPopover)}
          className={`p-2 rounded-lg transition-colors h-9 w-9 flex items-center justify-center ${showPopover ? 'bg-secondary text-blue-400' : 'text-textMuted hover:text-blue-400 hover:bg-secondary'}`}
          title="Open Timer"
        >
          <TimerIcon size={18} />
        </button>
      )}

      {showPopover && (
        <div className="absolute top-12 right-0 bg-[#262626] border border-[#3e3e3e] rounded-xl shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 min-w-[280px]">
          <div className="flex gap-2 mb-3 h-[120px]">
            {mode === 'stopwatch' ? (
              <>
                <button className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-blue-500 bg-blue-500/10 transition-colors h-full">
                  <TimerIcon size={24} className="text-blue-500" />
                  <span className="text-xs font-medium text-white">Stopwatch</span>
                </button>
                <button onClick={() => setMode('timer')} className="flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#444] hover:bg-white/5 transition-colors h-full">
                  <Clock size={24} className="text-orange-500" />
                  <span className="text-xs font-medium text-gray-400">Timer</span>
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setMode('stopwatch')} className="w-16 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#444] hover:bg-white/5 transition-colors h-full">
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
                        className="w-11 h-9 bg-transparent border border-[#555] rounded-lg text-center text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
                        onBlur={() => setTimerHours(prev => (prev || '0').padStart(2, '0'))}
                      />
                      <span className="text-xs text-gray-400">hr</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="text" 
                        value={timerMinutes} 
                        onChange={handleMinuteChange} 
                        className="w-11 h-9 bg-transparent border border-[#555] rounded-lg text-center text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-colors"
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
              className="w-full bg-[#383838] hover:bg-[#444] text-[#ff4b4b] font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors border border-[#4a4a4a]"
            >
              <Square size={14} fill="currentColor" />
              {mode === 'stopwatch' ? 'End Stopwatch' : 'End Timer'}
            </button>
          ) : (
            <button 
              onClick={handleStart}
              disabled={mode === 'timer' && parseInt(timerHours || '0') === 0 && parseInt(timerMinutes || '0') === 0}
              className="w-full bg-[#f2f2f2] hover:bg-white disabled:opacity-50 disabled:hover:bg-[#f2f2f2] text-black font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
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
