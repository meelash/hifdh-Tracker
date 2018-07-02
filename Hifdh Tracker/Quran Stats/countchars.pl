#! /usr/bin/perl -w
#Did you know you can install perl modules easily through synaptic package manager?! 
#You may need to install this module if you want to run this script
use Unicode::String qw(utf8 latin1 utf16); 

#
## @author: Shadow Caster
## @date: Monday 9 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of the diacritic-free Arabic quran from 
## 114 text files and counts how many characters are in each file. It removes 
## spaces and gaps first. Only Arabic letters are counted. 
## It saves the results to a CSV file.
#

#The CSV file to print results to
open(CSVHANDLE, ">./c/charcount.csv") or die("Failed to open csv file");

#loops through all the surahs
for($i = 1; $i < 115; $i++){
	open(HANDLE, "./c/$i.txt") or die("Failed to open in file");

	#convert array to scalar
	@arr = <HANDLE>;
	$str = "@arr";
	chomp($str);

	#remove spaces
	$str =~ s/( |\s)//g;

	#interpret string as utf8 
	$uStr = utf8($str);

	#save to CSV file
	print CSVHANDLE "$i, ".$uStr->length."\n";

	close(HANDLE);
}

close(CSVHANDLE);
print "All Done! \n";
