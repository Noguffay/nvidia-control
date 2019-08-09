Here is a simple JS script that controls Nvidia GPU core voltage depending on its current temperature. It works in Windows and relies on two external utilities: nvidia-smi (https://developer.nvidia.com/nvidia-system-management-interface) and NvidiaInspector (https://www.nvidiainspector.com/)

Revision #1 Hashrate Maximization Module

Steps AND Requirements of the Hashrate MAXIMIZATION Procedure:
ADD: SMI api PowerDraw Logging
ADD: MAX Level PowerDraw allowance param [ ]
Controller starts up

CONTINUOUS Procedure: Performs NVC procedures (Nvidia Voltage Controller) (Normalization period)

CONTINUOUS Procedure: Measuring present power (Wattage) of each GPU Index number (Not to exceed max setting) (Measuring Logic/Logging/Setting logic)

Start of Hashrate MAXIMIZATION Procedure:
10 minutes Delay. Timeout

If PowerDrawLevel PDL has Decreased or are the Same, Go to Step#1 (For only GPU Index numbers that have Decreased, or are the Same)

Step#1 is performed, RAISING MemoryClockOffset MCO by 10MHz (for All GPU Index numbers, BELOW MAX PowerDrawLevel mPDL)
Does power increase/decrease/stay the same after 30sec? (Measuring/30sec delayed comparator logic ) 
IF Increase = Do no more (> startup recorded power for All GPU Index numbers, BELOW mPDL)
IF Decrease = Go back (< startup recorded power for All GPU Index numbers, BELOW mPDL)
IF Same = STAY (= startup recorded power for All GPU Index numbers, BELOW mPDL)

10 minutes Delay. Timeout
If Power decreases, Go to Step#2 (For only GPU Index numbers that decreased)

Step#2 is performed, LOWERING MCO by 10MHz (All GPU Index numbers, BELOW mPDL)
Does power increase/decrease/stay the same after 30sec? (Measuring/30sec delayed comparator logic ) 
IF Increase = Do no more (> startup recorded power for All GPU Index numbers, BELOW mPDL)
IF Decrease = Go Back (< startup recorded power for All GPU Index numbers, BELOW mPDL)
IF Same = STAY (= startup recorded power for All GPU Index numbers, BELOW mPDL)

RETURN TO:  Start Hashrate MAXIMIZATION Procedure:
