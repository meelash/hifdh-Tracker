#! /usr/bin/perl -w

#
## @author: meelash
## --thanks to ShadowCaster :)
## @date: Monday 7 Dec 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of the diacritic-free Arabic quran from 
## 114 text files and counts how many characters are in each ayah. It removes 
## spaces and gaps first. Only Arabic letters are counted.
## It saves the results to a CSV file.
#

#The CSV file to print results to
open(CSVHANDLE, ">./c/charcountbyayah.csv") or die("Failed to open csv file");


#loops through all the surahs
for($i = 1; $i < 115; $i++)
{
	open (HANDLE, "<utf8", "./c/$i.txt") or die("Failed to open in file"); #open as utf-8 file
	
	#loop through all the ayahs
	while(<HANDLE>)
	{
	chomp($_); #remove newline
	$_ =~ s/( |\s)//g; #remove spaces
	
	#save to CSV file
	print CSVHANDLE $i.", ".$..", ".length($_)."\n";
	}
	
	close(HANDLE);
}

close(CSVHANDLE);
print "All Done! \n";
